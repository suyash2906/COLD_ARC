import { describe, expect, it } from 'vitest'
import { addDays, arcDay, daysBetween, isoWeekKey, startOfWeek, weekdayIndex } from './dates'
import { logId } from '../db/schema'
import { commitmentRates, computeStreaks, scoreDay, scoreRange, summarizeWeeks, type ScoringInput } from './scoring'
import type { Arc, Commitment } from './types'

// 2026-10-05 is a Monday, which keeps the weekly-cadence cases readable.
const MONDAY = '2026-10-05'

function arc(over: Partial<Arc> = {}): Arc {
  return {
    id: 'a1',
    name: 'Test Arc',
    presetId: 'custom',
    startDate: MONDAY,
    totalDays: 90,
    strictness: 'strict',
    graceTokens: 0,
    signedAt: null,
    createdAt: 0,
    status: 'active',
    ...over,
  }
}

function commitment(over: Partial<Commitment> = {}): Commitment {
  return {
    id: 'c1',
    arcId: 'a1',
    label: 'Gym',
    icon: 'dumbbell',
    kind: 'bool',
    target: 1,
    direction: 'at_least',
    unit: '',
    cadence: 'daily',
    timesPerWeek: 7,
    weight: 1,
    order: 0,
    archivedAt: null,
    ...over,
  }
}

function input(commitments: Commitment[], logs: Record<string, number> = {}, a: Arc = arc()): ScoringInput {
  return { arc: a, commitments, logs: new Map(Object.entries(logs)) }
}

describe('dates', () => {
  it('counts whole days regardless of DST shifts', () => {
    expect(daysBetween('2026-10-05', '2026-10-12')).toBe(7)
    expect(daysBetween('2026-10-12', '2026-10-05')).toBe(-7)
    // US DST ends 2026-11-01; a naive ms/86400000 would yield 30.04 here.
    expect(daysBetween('2026-10-25', '2026-11-25')).toBe(31)
  })

  it('treats Monday as the start of the week', () => {
    expect(weekdayIndex(MONDAY)).toBe(0)
    expect(startOfWeek('2026-10-11')).toBe(MONDAY) // Sunday belongs to the week that began Monday
    expect(startOfWeek(MONDAY)).toBe(MONDAY)
  })

  it('gives every day of one week the same week key', () => {
    const keys = new Set(Array.from({ length: 7 }, (_, i) => isoWeekKey(addDays(MONDAY, i))))
    expect(keys.size).toBe(1)
    expect(isoWeekKey(addDays(MONDAY, 7))).not.toBe(isoWeekKey(MONDAY))
  })

  it('numbers arc days from 1', () => {
    expect(arcDay(MONDAY, MONDAY)).toBe(1)
    expect(arcDay(MONDAY, addDays(MONDAY, 41))).toBe(42)
  })
})

describe('scoreDay', () => {
  it('scores a fully logged day at 100 and marks it perfect', () => {
    const cs = [commitment({ id: 'c1' }), commitment({ id: 'c2', label: 'Read' })]
    const day = scoreDay(input(cs, { [logId('c1', MONDAY)]: 1, [logId('c2', MONDAY)]: 1 }), MONDAY)
    expect(day.score).toBe(100)
    expect(day.perfect).toBe(true)
    expect(day.completed).toBe(2)
  })

  it('distinguishes an untouched day from a logged zero', () => {
    const cs = [commitment()]
    expect(scoreDay(input(cs), MONDAY).touched).toBe(false)
    expect(scoreDay(input(cs, { [logId('c1', MONDAY)]: 0 }), MONDAY).touched).toBe(true)
  })

  it('gives partial credit toward a count target without counting it satisfied', () => {
    const cs = [commitment({ kind: 'count', target: 20, unit: 'pages' })]
    const day = scoreDay(input(cs, { [logId('c1', MONDAY)]: 15 }), MONDAY)
    expect(day.score).toBe(75)
    expect(day.perfect).toBe(false)
    expect(day.completed).toBe(0)
  })

  it('does not award over 100 for overshooting a target', () => {
    const cs = [commitment({ kind: 'count', target: 20 })]
    expect(scoreDay(input(cs, { [logId('c1', MONDAY)]: 60 }), MONDAY).score).toBe(100)
  })

  it('treats at_most targets as ceilings', () => {
    const cs = [commitment({ kind: 'duration', target: 60, direction: 'at_most', label: 'Screen time' })]
    expect(scoreDay(input(cs, { [logId('c1', MONDAY)]: 45 }), MONDAY).perfect).toBe(true)
    expect(scoreDay(input(cs, { [logId('c1', MONDAY)]: 120 }), MONDAY).score).toBe(50)
  })

  it('honours weights when averaging', () => {
    const cs = [commitment({ id: 'c1', weight: 3 }), commitment({ id: 'c2', weight: 1 })]
    // Heavy commitment done, light one missed => 3/4.
    expect(scoreDay(input(cs, { [logId('c1', MONDAY)]: 1 }), MONDAY).score).toBe(75)
  })

  it('ignores archived commitments', () => {
    const cs = [commitment({ id: 'c1' }), commitment({ id: 'c2', archivedAt: 123 })]
    const day = scoreDay(input(cs, { [logId('c1', MONDAY)]: 1 }), MONDAY)
    expect(day.total).toBe(1)
    expect(day.score).toBe(100)
  })
})

describe('weekly cadence pacing', () => {
  const gym = commitment({ cadence: 'n_per_week', timesPerWeek: 5 })

  it('does not require a 5x/week commitment early in the week', () => {
    // Monday, nothing done: 5 needed with 7 days left, so skipping today is still on pace.
    const day = scoreDay(input([gym]), MONDAY)
    expect(day.results[0].scheduled).toBe(false)
    expect(day.total).toBe(0)
  })

  it('starts counting it as a miss once the quota is out of reach', () => {
    // Wednesday with none done: 5 needed, only 5 days left, so today is mandatory.
    const wednesday = addDays(MONDAY, 2)
    const day = scoreDay(input([gym]), wednesday)
    expect(day.results[0].scheduled).toBe(true)
    expect(day.results[0].satisfied).toBe(false)
    expect(day.score).toBe(0)
  })

  it('gives full credit for rest days once the weekly quota is met', () => {
    const logs = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [logId('c1', addDays(MONDAY, i)), 1]),
    )
    const saturday = addDays(MONDAY, 5)
    const day = scoreDay(input([gym], logs), saturday)
    expect(day.perfect).toBe(true)
    expect(day.score).toBe(100)
  })

  it('clips the remaining runway to the end of the arc', () => {
    // A one-week arc ending Sunday: on Saturday only two days remain, so a 5x quota is unreachable.
    const shortArc = arc({ totalDays: 7 })
    const day = scoreDay(input([gym], {}, shortArc), addDays(MONDAY, 5))
    expect(day.results[0].scheduled).toBe(true)
    expect(day.results[0].satisfied).toBe(false)
  })
})

describe('streaks', () => {
  const cs = [commitment()]
  const daily = (n: number, skip: number[] = []) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => i)
        .filter((i) => !skip.includes(i))
        .map((i) => [logId('c1', addDays(MONDAY, i)), 1]),
    )

  it('counts consecutive qualifying days', () => {
    const today = addDays(MONDAY, 9)
    const s = computeStreaks(input(cs, daily(10)), today)
    expect(s.current).toBe(10)
    expect(s.longest).toBe(10)
    expect(s.perfectDays).toBe(10)
  })

  it('breaks a strict streak on any imperfect day', () => {
    const today = addDays(MONDAY, 9)
    const s = computeStreaks(input(cs, daily(10, [4])), today) // missed day 5
    expect(s.current).toBe(5)
    expect(s.longest).toBe(5)
  })

  it('keeps a forgiving streak alive above the 80% threshold', () => {
    const partial = [
      commitment({ id: 'c1' }),
      commitment({ id: 'c2' }),
      commitment({ id: 'c3' }),
      commitment({ id: 'c4' }),
      commitment({ id: 'c5' }),
    ]
    const logs: Record<string, number> = {}
    for (let i = 0; i < 5; i++) {
      for (const c of partial) {
        // On day 3, skip one of five commitments => 80%.
        if (i === 2 && c.id === 'c5') continue
        logs[logId(c.id, addDays(MONDAY, i))] = 1
      }
    }
    const today = addDays(MONDAY, 4)
    const forgiving = input(partial, logs, arc({ strictness: 'forgiving' }))
    expect(computeStreaks(forgiving, today).current).toBe(5)

    const strict = input(partial, logs, arc({ strictness: 'strict' }))
    expect(computeStreaks(strict, today).current).toBe(2)
  })

  it('spends grace tokens to bridge a miss', () => {
    const today = addDays(MONDAY, 9)
    const withGrace = input(cs, daily(10, [4]), arc({ graceTokens: 2 }))
    const s = computeStreaks(withGrace, today)
    expect(s.current).toBe(10)
    expect(s.graceRemaining).toBe(1)
  })

  it('spends grace tokens chronologically and breaks once they run out', () => {
    const today = addDays(MONDAY, 9)
    const withGrace = input(cs, daily(10, [2, 5, 8]), arc({ graceTokens: 2 }))
    const s = computeStreaks(withGrace, today)
    // Days 3 and 6 are covered; day 9 has no token left, so only day 10 survives.
    expect(s.graceRemaining).toBe(0)
    expect(s.current).toBe(1)
    expect(s.longest).toBe(8)
  })

  it('does not break the streak just because today is still incomplete', () => {
    const today = addDays(MONDAY, 5)
    // Five perfect days, then nothing logged yet today.
    const s = computeStreaks(input(cs, daily(5)), today)
    expect(s.current).toBe(5)
  })

  it('only counts days that have actually elapsed', () => {
    const today = addDays(MONDAY, 2)
    const s = computeStreaks(input(cs, daily(3)), today)
    expect(s.elapsed).toBe(3)
    expect(s.averageScore).toBe(100)
  })

  it('handles a backdated start by treating unlogged history as missed', () => {
    const today = addDays(MONDAY, 9)
    const s = computeStreaks(input(cs, daily(10, [0, 1, 2])), today)
    expect(s.elapsed).toBe(10)
    expect(s.current).toBe(7)
    expect(s.averageScore).toBe(70)
  })
})

describe('cross-window fairness', () => {
  it('ranks two different arc windows on the same week identically', () => {
    const cs = [commitment()]
    const week = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i))
    const logs = Object.fromEntries(week.slice(0, 6).map((d) => [logId('c1', d), 1]))

    // One arc began five weeks earlier and runs long; the other starts this very Monday.
    const veteran = arc({ startDate: addDays(MONDAY, -35), totalDays: 151 })
    const rookie = arc({ startDate: MONDAY, totalDays: 75 })

    const a = summarizeWeeks(scoreRange(input(cs, logs, veteran), week))[0]
    const b = summarizeWeeks(scoreRange(input(cs, logs, rookie), week))[0]

    expect(a.total).toBe(600)
    expect(a.total).toBe(b.total)
    expect(a.perfectDays).toBe(b.perfectDays)
  })

  it('caps a weekly total at 700', () => {
    const cs = [commitment()]
    const week = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i))
    const logs = Object.fromEntries(week.map((d) => [logId('c1', d), 1]))
    expect(summarizeWeeks(scoreRange(input(cs, logs), week))[0].total).toBe(700)
  })
})

describe('commitmentRates', () => {
  it('reports completion rate per commitment over scheduled days only', () => {
    const cs = [commitment({ id: 'c1' }), commitment({ id: 'c2' })]
    const days = Array.from({ length: 4 }, (_, i) => addDays(MONDAY, i))
    const logs: Record<string, number> = {}
    for (const d of days) logs[logId('c1', d)] = 1
    logs[logId('c2', days[0])] = 1

    const rates = commitmentRates(scoreRange(input(cs, logs), days))
    expect(rates.get('c1')?.rate).toBe(100)
    expect(rates.get('c2')?.rate).toBe(25)
  })
})
