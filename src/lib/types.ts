import type { ISODate } from './dates'

/** How a commitment is satisfied. */
export type CommitmentKind =
  | 'bool' // did it or didn't (Gym, No alcohol)
  | 'count' // hit a number (20 pages, 10000 steps, 4L water)
  | 'duration' // minutes, with an optional ceiling instead of a floor (screen time)
  | 'time' // be done by a deadline (wake by 05:30)

export type Cadence = 'daily' | 'n_per_week'

/**
 * `strict` breaks the streak on any imperfect day; `forgiving` keeps it alive at >=80%.
 * The Winter Arc has no official rulebook, so this is the user's call, not ours.
 */
export type Strictness = 'strict' | 'forgiving'

export type ArcStatus = 'active' | 'completed' | 'abandoned'

export interface Arc {
  id: string
  name: string
  presetId: string
  startDate: ISODate
  /** Canonical length. The end date is always derived, never stored, so the two can't drift. */
  totalDays: number
  strictness: Strictness
  /** Misses that can be absorbed without breaking the streak, across the whole arc. */
  graceTokens: number
  signedAt: number | null
  createdAt: number
  status: ArcStatus
}

export interface Commitment {
  id: string
  arcId: string
  label: string
  icon: string
  kind: CommitmentKind
  /** count/duration: the number to hit. time: minutes past midnight. bool: unused. */
  target: number
  /** For `count`/`duration`, whether the target is a floor to clear or a ceiling to stay under. */
  direction: 'at_least' | 'at_most'
  unit: string
  cadence: Cadence
  timesPerWeek: number
  /** Relative contribution to the day score. Defaults to 1. */
  weight: number
  order: number
  archivedAt: number | null
}

export interface LogEntry {
  /** `${commitmentId}:${date}` — makes logging an idempotent put rather than a query-then-write. */
  id: string
  arcId: string
  commitmentId: string
  date: ISODate
  value: number
  loggedAt: number
}

export interface DayRecord {
  /** `${arcId}:${date}` */
  id: string
  arcId: string
  date: ISODate
  mood: number | null
  winOfTheDay: string | null
  graceUsed: boolean
}

/** Device-only. Never enters the sync queue. */
export interface JournalEntry {
  id: string
  arcId: string
  date: ISODate
  body: string
  updatedAt: number
}

/** Device-only. Blobs live in IndexedDB and are excluded from sync by design. */
export interface Photo {
  id: string
  arcId: string
  date: ISODate
  blob: Blob
  width: number
  height: number
  createdAt: number
}

export type SyncKind = 'daily_score' | 'arc_public' | 'streak_event'

export interface SyncItem {
  id?: number
  kind: SyncKind
  /** Dedupe key so repeated edits to the same day collapse into one pending row. */
  dedupeKey: string
  payload: unknown
  attempts: number
  lastError: string | null
  createdAt: number
}

export interface Settings {
  key: string
  value: unknown
}
