import type { ISODate } from './dates'
import type { Commitment } from './types'

/**
 * Apple Health cannot be read from a web app, so an iOS Shortcut reads it and copies a
 * small text block to the clipboard, which the app then pastes in:
 *
 *   COLDARC
 *   S 2026-10-01 8123        steps for that day
 *   W 2026-10-01 34          one workout, in minutes (Hevy sessions land here too)
 *
 * Several lines for the same day add up.
 */

export const HEALTH_HEADER = 'COLDARC'
export const SHORTCUT_NAME = 'Cold Arc Sync'

export interface HealthDays {
  steps: Map<ISODate, number>
  workoutMinutes: Map<ISODate, number>
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** "8,123" or "8123.0" -> 8123. */
function amount(raw: string): number {
  return Number.parseFloat(raw.replace(/,/g, ''))
}

export function parseHealth(text: string): HealthDays | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines[0]?.toUpperCase() !== HEALTH_HEADER) return null

  const steps = new Map<ISODate, number>()
  const workoutMinutes = new Map<ISODate, number>()
  for (const line of lines.slice(1)) {
    const [kind, date, raw] = line.split(/\s+/)
    // "Time between dates" in Shortcuts can come out negative depending on which date is
    // first; a workout's length is its length either way.
    const n = Math.abs(amount(raw ?? ''))
    if (!DATE.test(date ?? '') || !Number.isFinite(n)) continue
    const into = kind?.toUpperCase() === 'S' ? steps : kind?.toUpperCase() === 'W' ? workoutMinutes : null
    into?.set(date, (into.get(date) ?? 0) + n)
  }
  return { steps, workoutMinutes }
}

/** The commitment Health steps should fill: anything counted in steps. */
export function stepsCommitment(commitments: Commitment[]): Commitment | undefined {
  return commitments.find((c) => !c.archivedAt && c.kind === 'count' && /step/i.test(c.unit))
}

/** The commitment workout minutes should fill: a workout / training / gym habit. */
export function workoutCommitment(commitments: Commitment[]): Commitment | undefined {
  return commitments.find(
    (c) => !c.archivedAt && (c.kind === 'duration' || c.kind === 'bool') && /workout|train|gym|lift|exercise/i.test(c.label),
  )
}
