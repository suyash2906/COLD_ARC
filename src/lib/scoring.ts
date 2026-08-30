import { addDays, arcDay, clamp, daysBetween, isoWeekKey, startOfWeek, weekdayIndex, type ISODate } from './dates'
import { logId } from '../db/schema'
import type { Arc, Commitment, Strictness } from './types'

/**
 * The single source of truth for "how did today go". Today ring, grid, stats,
 * leaderboard and duel resolution all read from here — never re-derive it elsewhere.
 */

export interface ScoringInput {
  arc: Arc
  commitments: Commitment[]
  /** logId(commitmentId, date) -> logged value */
  logs: Map<string, number>
}

export interface CommitmentResult {
  commitment: Commitment
  /** False when an n_per_week commitment is not required today; excluded from the day score. */
  scheduled: boolean
  /** 0..1 partial credit, used for the score. */
  fraction: number
  /** Binary, used for perfect days and streaks. */
  satisfied: boolean
  value: number | null
}

export interface DayScore {
  date: ISODate
  /** 0..100, weighted mean of scheduled commitments partial credit. */
  score: number
  completed: number
  total: number
  perfect: boolean
  /** Whether anything was logged at all — distinguishes a real zero from an untouched day. */
  touched: boolean
  results: CommitmentResult[]
}

export const streakThreshold = (s: Strictness) => (s === 'strict' ? 100 : 80)

function valueFor(input: ScoringInput, c: Commitment, date: ISODate): number | null {
  const v = input.logs.get(logId(c.id, date))
  return v === undefined ? null : v
}

/** Did this commitment clear its own bar on this specific date, ignoring cadence? */
function metOn(input: ScoringInput, c: Commitment, date: ISODate): boolean {
  const v = valueFor(input, c, date)
  if (v === null) return false
  if (c.kind === 'bool') return v >= 1
  return c.direction === 'at_most' ? v <= c.target : v >= c.target
}

function fractionOf(c: Commitment, v: number | null): number {
  if (v === null) return 0
  if (c.kind === 'bool') return v >= 1 ? 1 : 0
  if (c.target <= 0) return 1
  return c.direction === 'at_most'
    ? v <= c.target
      ? 1
      : clamp(c.target / v, 0, 1)
    : clamp(v / c.target, 0, 1)
}

/**
 * Weekly-cadence commitments (gym 5x/week) are not tied to a weekday, so a plain daily
 * check would punish every rest day. Instead a commitment only counts against you once
 * skipping it would put the weekly quota out of reach.
 */
function weeklyStatus(
  input: ScoringInput,
  c: Commitment,
  date: ISODate,
): { scheduled: boolean; satisfied: boolean; fraction: number } {
  if (metOn(input, c, date)) return { scheduled: true, satisfied: true, fraction: 1 }

  const weekStart = startOfWeek(date)
  let done = 0
  for (let i = 0; i < 7; i++) {
    if (metOn(input, c, addDays(weekStart, i))) done++
  }
  if (done >= c.timesPerWeek) {
    // Quota already met this week — the rest of the week is earned rest, at full credit.
    return { scheduled: true, satisfied: true, fraction: 1 }
  }

  const remainingNeeded = c.timesPerWeek - done
  // Days left in the week counting today, clipped to the end of the arc.
  const lastArcDay = addDays(input.arc.startDate, input.arc.totalDays - 1)
  const daysLeft = Math.min(7 - weekdayIndex(date), daysBetween(date, lastArcDay) + 1)

  return remainingNeeded >= daysLeft
    ? { scheduled: true, satisfied: false, fraction: 0 } // must go today; skipping is a real miss
    : { scheduled: false, satisfied: false, fraction: 0 } // still on pace, not required today
}

export function scoreDay(input: ScoringInput, date: ISODate): DayScore {
  const active = input.commitments.filter((c) => !c.archivedAt)
  const results: CommitmentResult[] = []
  let weighted = 0
  let weightTotal = 0
  let completed = 0
  let total = 0
  let touched = false
  let allSatisfied = true

  for (const c of active) {
    const value = valueFor(input, c, date)
    if (value !== null) touched = true

    let scheduled = true
    let satisfied: boolean
    let fraction: number

    if (c.cadence === 'n_per_week') {
      const w = weeklyStatus(input, c, date)
      scheduled = w.scheduled
      satisfied = w.satisfied
      fraction = w.fraction
    } else {
      satisfied = metOn(input, c, date)
      fraction = fractionOf(c, value)
    }

    results.push({ commitment: c, scheduled, fraction, satisfied, value })

    if (!scheduled) continue
    const w = c.weight > 0 ? c.weight : 1
    weighted += fraction * w
    weightTotal += w
    total++
    if (satisfied) completed++
    else allSatisfied = false
  }

  const score = weightTotal === 0 ? 0 : Math.round((weighted / weightTotal) * 100)
  return { date, score, completed, total, perfect: total > 0 && allSatisfied, touched, results }
}

export function scoreRange(input: ScoringInput, dates: ISODate[]): DayScore[] {
  return dates.map((d) => scoreDay(input, d))
}

/** Every date the arc covers, whether or not it has been reached yet. */
export function arcDates(arc: Arc): ISODate[] {
  return Array.from({ length: arc.totalDays }, (_, i) => addDays(arc.startDate, i))
}

export interface StreakInfo {
  current: number
  longest: number
  graceRemaining: number
  perfectDays: number
  /** Days elapsed in the arc, capped at its length. */
  elapsed: number
  /** Mean score over elapsed days — the fair all-time leaderboard metric. */
  averageScore: number
}

/**
 * Grace tokens are spent forward in time, so "I get 3 skips this arc" behaves the way a
 * person expects rather than silently re-allocating itself as history changes.
 *
 * Today never breaks a streak. A tracker that zeroes you out at 9am because you have not
 * been to the gym yet would be actively wrong.
 */
export function computeStreaks(input: ScoringInput, today: ISODate, scores?: DayScore[]): StreakInfo {
  const { arc } = input
  const threshold = streakThreshold(arc.strictness)
  const dates = arcDates(arc)
  const all = scores ?? scoreRange(input, dates)

  const elapsedCount = clamp(arcDay(arc.startDate, today), 0, arc.totalDays)

  let current = 0
  let longest = 0
  let grace = arc.graceTokens
  let perfectDays = 0
  let scoreSum = 0

  for (let i = 0; i < elapsedCount; i++) {
    const day = all[i]
    const isToday = day.date === today
    if (day.perfect) perfectDays++
    scoreSum += day.score

    if (day.score >= threshold) {
      current++
    } else if (isToday) {
      break // still in play; leave the streak standing
    } else if (grace > 0) {
      grace--
      current++
    } else {
      current = 0
    }
    longest = Math.max(longest, current)
  }

  return {
    current,
    longest,
    graceRemaining: grace,
    perfectDays,
    elapsed: elapsedCount,
    averageScore: elapsedCount === 0 ? 0 : Math.round(scoreSum / elapsedCount),
  }
}

export interface WeekSummary {
  weekKey: string
  weekStart: ISODate
  /** Sum of day scores, 0..700. The weekly leaderboard metric. */
  total: number
  average: number
  perfectDays: number
  days: DayScore[]
}

/**
 * Grouping by calendar week rather than arc day is what lets people on different arc
 * windows compete fairly — everyone is judged on the same seven days.
 */
export function summarizeWeeks(scores: DayScore[]): WeekSummary[] {
  const byWeek = new Map<string, DayScore[]>()
  for (const s of scores) {
    const key = isoWeekKey(s.date)
    const bucket = byWeek.get(key)
    if (bucket) bucket.push(s)
    else byWeek.set(key, [s])
  }
  return [...byWeek.entries()]
    .map(([weekKey, days]) => ({
      weekKey,
      weekStart: startOfWeek(days[0].date),
      total: days.reduce((n, d) => n + d.score, 0),
      average: Math.round(days.reduce((n, d) => n + d.score, 0) / days.length),
      perfectDays: days.filter((d) => d.perfect).length,
      days,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** Per-commitment completion rate across elapsed days, for the stats screen. */
export function commitmentRates(scores: DayScore[]): Map<string, { done: number; scheduled: number; rate: number }> {
  const out = new Map<string, { done: number; scheduled: number; rate: number }>()
  for (const day of scores) {
    for (const r of day.results) {
      if (!r.scheduled) continue
      const cur = out.get(r.commitment.id) ?? { done: 0, scheduled: 0, rate: 0 }
      cur.scheduled++
      if (r.satisfied) cur.done++
      cur.rate = Math.round((cur.done / cur.scheduled) * 100)
      out.set(r.commitment.id, cur)
    }
  }
  return out
}
