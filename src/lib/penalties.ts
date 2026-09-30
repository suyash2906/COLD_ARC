import { addDays, arcDay, toISODate, type ISODate } from './dates'
import type { DayScore } from './scoring'
import type { Arc, Commitment, DayRecord } from './types'

export type Exercise = 'push-ups' | 'squats'

export interface Penalty {
  date: ISODate
  commitment: Commitment
  exercise: Exercise
  reps: number
}

/** Unpaid penalties expire after a week, so one bad stretch cannot bury the whole arc. */
export const PENALTY_WINDOW_DAYS = 7

/** 10 reps in the first month, then 5 more each month: easy to start, climbing as you get fitter. */
export function repsFor(arc: Arc, date: ISODate): number {
  const month = Math.max(0, Math.floor((arcDay(arc.startDate, date) - 1) / 30))
  return 10 + 5 * month
}

/** Musts alternate push-ups and squats in contract order, so each one always costs the same exercise. */
export function exerciseFor(commitments: Commitment[], c: Commitment): Exercise {
  const musts = commitments.filter((x) => x.important && !x.archivedAt).sort((a, b) => a.order - b.order)
  return musts.findIndex((x) => x.id === c.id) % 2 === 0 ? 'push-ups' : 'squats'
}

/**
 * Every must that was due and missed on a finished day, minus the ones already paid.
 * Today is still in play, and days before the contract was signed never count.
 */
export function owedPenalties(
  arc: Arc,
  commitments: Commitment[],
  scores: DayScore[],
  records: DayRecord[],
  today: ISODate,
): Penalty[] {
  const paid = new Map(records.map((r) => [r.date, new Set(r.penaltiesDone ?? [])]))
  const signedOn = arc.signedAt ? toISODate(new Date(arc.signedAt)) : arc.startDate
  const from = addDays(today, -PENALTY_WINDOW_DAYS)
  const out: Penalty[] = []

  for (const day of scores) {
    if (day.date >= today || day.date < from || day.date < signedOn) continue
    for (const r of day.results) {
      const c = r.commitment
      if (!c.important || !r.scheduled || r.satisfied || paid.get(day.date)?.has(c.id)) continue
      out.push({ date: day.date, commitment: c, exercise: exerciseFor(commitments, c), reps: repsFor(arc, day.date) })
    }
  }
  return out
}

/** "20 push-ups · 10 squats" */
export function summarize(penalties: Penalty[]): string {
  const totals = new Map<Exercise, number>()
  for (const p of penalties) totals.set(p.exercise, (totals.get(p.exercise) ?? 0) + p.reps)
  return [...totals.entries()].map(([exercise, reps]) => `${reps} ${exercise}`).join(' · ')
}
