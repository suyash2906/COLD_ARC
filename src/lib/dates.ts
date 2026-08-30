/**
 * Every date in Cold Arc is a local `YYYY-MM-DD` string, never a timestamp.
 *
 * A habit tracker's day boundary is whatever midnight means *to the user*. Storing
 * instants and converting on read produces the classic bug where a 11pm log jumps to
 * tomorrow for anyone east of UTC. Plain local date strings sidestep it entirely.
 */
export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parses to local midnight. `new Date('2026-10-01')` would parse as UTC — hence the manual split. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Whole days from `a` to `b`; negative when `b` precedes `a`. DST-safe via UTC noon anchoring. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

export function dateRange(start: ISODate, count: number): ISODate[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i))
}

/** Last day the arc is active. An arc of N days starting on S ends on S+N-1. */
export function arcEndDate(start: ISODate, totalDays: number): ISODate {
  return addDays(start, Math.max(1, totalDays) - 1)
}

/** 1-based day number within the arc. Returns <1 before the start, >totalDays after the end. */
export function arcDay(start: ISODate, on: ISODate = todayISO()): number {
  return daysBetween(start, on) + 1
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Monday-based week start, matching ISO-8601. */
export function startOfWeek(iso: ISODate): ISODate {
  const d = fromISODate(iso)
  // getDay(): 0=Sun..6=Sat. Shift so Monday is 0.
  return addDays(iso, -((d.getDay() + 6) % 7))
}

/** Stable sortable week identifier, e.g. `2026-W35`. */
export function isoWeekKey(iso: ISODate): string {
  const d = fromISODate(iso)
  // Shift to the Thursday of this week; the ISO year is whatever year that Thursday lands in.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const isoYear = d.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3)
  const week = 1 + Math.round(daysBetween(toISODate(firstThursday), toISODate(d)) / 7)
  return `${isoYear}-W${pad(week)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function formatShort(iso: ISODate): string {
  const d = fromISODate(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function formatLong(iso: ISODate): string {
  const d = fromISODate(iso)
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function weekdayIndex(iso: ISODate): number {
  return (fromISODate(iso).getDay() + 6) % 7
}
