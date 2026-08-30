import { daysBetween, fromISODate, toISODate, todayISO, type ISODate } from './dates'
import type { Commitment, Strictness } from './types'

export type CommitmentTemplate = Omit<Commitment, 'id' | 'arcId' | 'order' | 'archivedAt'>

export interface ContractPreset {
  id: string
  name: string
  tagline: string
  strictness: Strictness
  graceTokens: number
  /** Fixed-length programmes pin their duration; the Winter Arc leaves it to the window picker. */
  fixedDays: number | null
  commitments: CommitmentTemplate[]
}

function t(over: Partial<CommitmentTemplate> & Pick<CommitmentTemplate, 'label' | 'icon'>): CommitmentTemplate {
  return {
    kind: 'bool',
    target: 1,
    direction: 'at_least',
    unit: '',
    cadence: 'daily',
    timesPerWeek: 7,
    weight: 1,
    ...over,
  }
}

/** `time` targets are minutes past midnight, so 05:30 is 330. */
export const minutesToClock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`
export const clockToMinutes = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const CONTRACT_PRESETS: ContractPreset[] = [
  {
    id: 'winter-arc',
    name: 'Winter Arc',
    tagline: 'The classic five. Train, rise early, read, go quiet, reflect.',
    strictness: 'forgiving',
    graceTokens: 3,
    fixedDays: null,
    commitments: [
      t({ label: 'Train', icon: '🏋️', cadence: 'n_per_week', timesPerWeek: 5, weight: 2 }),
      t({ label: 'Wake up early', icon: '🌅', kind: 'time', target: 330, direction: 'at_most', unit: '' }),
      t({ label: 'Read', icon: '📖', kind: 'count', target: 20, unit: 'pages' }),
      t({ label: 'Ghost mode', icon: '📵', kind: 'duration', target: 60, direction: 'at_most', unit: 'min' }),
      t({ label: 'Journal', icon: '🖊️', weight: 1 }),
    ],
  },
  {
    id: '75-hard',
    name: '75 Hard',
    tagline: 'Six non-negotiables, 75 days, no grace. Miss one and you restart.',
    strictness: 'strict',
    graceTokens: 0,
    fixedDays: 75,
    commitments: [
      t({ label: 'Workout', icon: '💪', kind: 'duration', target: 45, unit: 'min', weight: 2 }),
      t({ label: 'Outdoor workout', icon: '🌦️', kind: 'duration', target: 45, unit: 'min', weight: 2 }),
      t({ label: 'Follow the diet', icon: '🥗' }),
      t({ label: 'Water', icon: '💧', kind: 'count', target: 3.8, unit: 'L' }),
      t({ label: 'Read non-fiction', icon: '📚', kind: 'count', target: 10, unit: 'pages' }),
      t({ label: 'Progress photo', icon: '📸' }),
    ],
  },
  {
    id: '75-medium',
    name: '75 Medium',
    tagline: 'The same shape, survivable. One workout, one cheat meal a week.',
    strictness: 'forgiving',
    graceTokens: 3,
    fixedDays: 75,
    commitments: [
      t({ label: 'Workout', icon: '💪', kind: 'duration', target: 45, unit: 'min', weight: 2 }),
      t({ label: 'Follow the diet', icon: '🥗' }),
      t({ label: 'Water', icon: '💧', kind: 'count', target: 2, unit: 'L' }),
      t({ label: 'Read', icon: '📚', kind: 'count', target: 10, unit: 'pages' }),
      t({ label: '10k steps', icon: '👟', kind: 'count', target: 10000, unit: 'steps' }),
    ],
  },
  {
    id: 'custom',
    name: 'Build your own',
    tagline: 'Start from nothing and write your own contract.',
    strictness: 'forgiving',
    graceTokens: 3,
    fixedDays: null,
    commitments: [],
  },
]

/** The picker shown when adding a commitment by hand. */
export const COMMITMENT_LIBRARY: CommitmentTemplate[] = [
  t({ label: 'Train', icon: '🏋️', cadence: 'n_per_week', timesPerWeek: 5 }),
  t({ label: 'Run', icon: '🏃', kind: 'count', target: 5, unit: 'km', cadence: 'n_per_week', timesPerWeek: 3 }),
  t({ label: '10k steps', icon: '👟', kind: 'count', target: 10000, unit: 'steps' }),
  t({ label: 'Wake up early', icon: '🌅', kind: 'time', target: 330, direction: 'at_most' }),
  t({ label: 'In bed by', icon: '🛏️', kind: 'time', target: 1380, direction: 'at_most' }),
  t({ label: 'Read', icon: '📖', kind: 'count', target: 20, unit: 'pages' }),
  t({ label: 'Water', icon: '💧', kind: 'count', target: 3, unit: 'L' }),
  t({ label: 'Ghost mode', icon: '📵', kind: 'duration', target: 60, direction: 'at_most', unit: 'min' }),
  t({ label: 'No alcohol', icon: '🚫' }),
  t({ label: 'Follow the diet', icon: '🥗' }),
  t({ label: 'Journal', icon: '🖊️' }),
  t({ label: 'Meditate', icon: '🧘', kind: 'duration', target: 10, unit: 'min' }),
  t({ label: 'Cold shower', icon: '🥶' }),
  t({ label: 'Study / deep work', icon: '🎯', kind: 'duration', target: 90, unit: 'min' }),
  t({ label: 'No spending', icon: '💸' }),
  t({ label: 'Progress photo', icon: '📸' }),
]

export interface WindowPreset {
  id: string
  name: string
  detail: string
  /** [month, day] of the start, resolved to the next occurrence. */
  from: [number, number]
  to: [number, number]
}

/**
 * Start dates genuinely vary — September for the early crowd, October for the traditional
 * arc — and plenty of people run theirs through February. None of this is hardcoded;
 * these are just shortcuts for the two date fields.
 */
export const WINDOW_PRESETS: WindowPreset[] = [
  { id: 'early', name: 'Early Arc', detail: 'Sep 1 → Jan 1', from: [9, 1], to: [1, 1] },
  { id: 'classic', name: 'Classic Arc', detail: 'Oct 1 → Jan 1', from: [10, 1], to: [1, 1] },
  { id: 'full-winter', name: 'Full Winter', detail: 'Oct 1 → Mar 1', from: [10, 1], to: [3, 1] },
  { id: 'deep-winter', name: 'Deep Winter', detail: 'Nov 1 → Mar 1', from: [11, 1], to: [3, 1] },
]

/**
 * Resolves [month, day] to the nearest sensible year. A start date is allowed to be
 * slightly in the past so that "I started on Oct 1" still works on Oct 9.
 */
function resolveStart([month, day]: [number, number], today: ISODate): ISODate {
  const now = fromISODate(today)
  const thisYear = new Date(now.getFullYear(), month - 1, day)
  // Anything more than ~5 weeks stale is far likelier to mean next year.
  if (daysBetween(toISODate(thisYear), today) > 35) {
    return toISODate(new Date(now.getFullYear() + 1, month - 1, day))
  }
  return toISODate(thisYear)
}

function resolveEndAfter(start: ISODate, [month, day]: [number, number]): ISODate {
  const s = fromISODate(start)
  const sameYear = new Date(s.getFullYear(), month - 1, day)
  return toISODate(sameYear > s ? sameYear : new Date(s.getFullYear() + 1, month - 1, day))
}

export interface ResolvedWindow {
  startDate: ISODate
  endDate: ISODate
  totalDays: number
}

export function resolveWindow(preset: WindowPreset, today: ISODate = todayISO()): ResolvedWindow {
  const startDate = resolveStart(preset.from, today)
  const target = resolveEndAfter(startDate, preset.to)
  // The named end date is the day the arc is *over*, so the last active day is the one before.
  const totalDays = daysBetween(startDate, target)
  return { startDate, endDate: daysToEnd(startDate, totalDays), totalDays }
}

export function daysToEnd(startDate: ISODate, totalDays: number): ISODate {
  const d = fromISODate(startDate)
  d.setDate(d.getDate() + Math.max(1, totalDays) - 1)
  return toISODate(d)
}

/** Inverse of the above: pick two dates, get a length. Inclusive of both ends. */
export function endToDays(startDate: ISODate, endDate: ISODate): number {
  return Math.max(1, daysBetween(startDate, endDate) + 1)
}
