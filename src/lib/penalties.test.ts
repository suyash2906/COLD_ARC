import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { logId } from '../db/schema'
import { exerciseFor, owedPenalties, repsFor, summarize } from './penalties'
import { arcDates, scoreRange, type ScoringInput } from './scoring'
import type { Arc, Commitment, DayRecord } from './types'

const START = '2026-10-01'

const arc: Arc = {
  id: 'a1',
  name: 'Cut & Study',
  presetId: 'cut-and-study',
  startDate: START,
  totalDays: 92,
  strictness: 'forgiving',
  graceTokens: 3,
  signedAt: new Date(2026, 8, 30).getTime(),
  createdAt: 0,
  status: 'active',
}

function commitment(id: string, order: number, important: boolean): Commitment {
  return {
    id,
    arcId: 'a1',
    label: id,
    icon: '•',
    kind: 'bool',
    target: 1,
    direction: 'at_least',
    unit: '',
    cadence: 'daily',
    timesPerWeek: 7,
    weight: 1,
    order,
    archivedAt: null,
    important,
  }
}

const study = commitment('study', 0, true)
const water = commitment('water', 1, false)
const workout = commitment('workout', 2, true)
const all = [study, water, workout]

function owed(logs: Record<string, number>, today: string, records: DayRecord[] = []) {
  const input: ScoringInput = { arc, commitments: all, logs: new Map(Object.entries(logs)) }
  return owedPenalties(arc, all, scoreRange(input, arcDates(arc)), records, today)
}

describe('penalties', () => {
  it('starts at 10 reps and adds 5 each month', () => {
    expect(repsFor(arc, START)).toBe(10)
    expect(repsFor(arc, addDays(START, 29))).toBe(10)
    expect(repsFor(arc, addDays(START, 30))).toBe(15)
    expect(repsFor(arc, addDays(START, 60))).toBe(20)
  })

  it('alternates push-ups and squats across the musts', () => {
    expect(exerciseFor(all, study)).toBe('push-ups')
    expect(exerciseFor(all, workout)).toBe('squats')
  })

  it('charges only for musts missed on finished days', () => {
    const today = addDays(START, 1)
    const list = owed({ [logId('workout', START)]: 1 }, today)
    // Study was missed yesterday; water is not a must; today is still in play.
    expect(list.map((p) => [p.date, p.commitment.id])).toEqual([[START, 'study']])
    expect(summarize(list)).toBe('10 push-ups')
  })

  it('drops penalties once paid', () => {
    const today = addDays(START, 1)
    const paid: DayRecord = {
      id: `a1:${START}`,
      arcId: 'a1',
      date: START,
      mood: null,
      winOfTheDay: null,
      graceUsed: false,
      penaltiesDone: ['study', 'workout'],
    }
    expect(owed({}, today, [paid])).toEqual([])
  })

  it('lets unpaid penalties expire after a week', () => {
    const today = addDays(START, 10)
    const dates = new Set(owed({}, today).map((p) => p.date))
    expect(dates.has(START)).toBe(false)
    expect(dates.has(addDays(START, 9))).toBe(true)
  })
})
