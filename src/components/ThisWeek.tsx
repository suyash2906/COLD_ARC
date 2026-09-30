import { logId } from '../db/schema'
import { addDays, formatShort, startOfWeek, type ISODate } from '../lib/dates'
import { formatQuantity } from '../lib/presets'
import type { Commitment } from '../lib/types'
import { Label, List } from './ui'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Monday to Sunday for every number-based habit: a bar per day against the goal line,
 * with the week's total and daily average. Steps fill in on their own after a Health sync.
 */
export function ThisWeek({
  commitments,
  logs,
  today,
}: {
  commitments: Commitment[]
  logs: Map<string, number>
  today: ISODate
}) {
  const start = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const elapsed = days.filter((d) => d <= today).length
  const numeric = commitments.filter((c) => !c.archivedAt && (c.kind === 'count' || c.kind === 'duration'))
  if (numeric.length === 0) return null

  return (
    <section className="mt-10">
      <Label
        right={
          <span className="text-faint text-[12.5px]">
            {formatShort(start)} – {formatShort(addDays(start, 6))}
          </span>
        }
      >
        This week
      </Label>
      <List>
        {numeric.map((c) => {
          const values = days.map((d) => logs.get(logId(c.id, d)) ?? 0)
          const total = values.reduce((sum, v) => sum + v, 0)
          const avg = elapsed ? total / elapsed : 0
          const peak = Math.max(c.target * 1.15, ...values)
          const ceiling = c.direction === 'at_most'
          // Litres keep a decimal; steps and minutes read better as whole numbers.
          const tidy = (n: number) => (c.unit === 'L' ? Math.round(n * 100) / 100 : Math.round(n))
          const perDay = `${formatQuantity(tidy(avg), c.unit)} a day`
          const summary = ceiling ? `avg ${perDay}` : `${formatQuantity(tidy(total), c.unit)} · ${perDay}`

          return (
            <div key={c.id} className="px-4 py-3.5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[15px]" aria-hidden>
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{c.label}</span>
                <span className="tnum text-muted shrink-0 text-[12.5px]">{summary}</span>
              </div>

              <div className="relative mt-3 flex h-14 items-end gap-2">
                {/* The goal, as a faint line across all seven days. */}
                <span
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/20"
                  style={{ bottom: `${(c.target / peak) * 100}%` }}
                  aria-hidden
                />
                {values.map((v, i) => {
                  const future = days[i] > today
                  const met = ceiling ? v > 0 && v <= c.target : v >= c.target
                  const over = ceiling && v > c.target
                  return (
                    <div key={days[i]} className="flex h-full flex-1 items-end justify-center">
                      <div
                        className="w-2.5 rounded-full transition-[height] duration-500"
                        style={{
                          height: future || v === 0 ? '4px' : `${Math.max(8, (v / peak) * 100)}%`,
                          background: future
                            ? 'rgb(255 255 255 / 0.05)'
                            : over
                              ? 'var(--color-fail)'
                              : met
                                ? 'var(--color-ice-300)'
                                : 'rgb(255 255 255 / 0.22)',
                          boxShadow: met && !future ? '0 0 10px rgb(163 224 255 / 0.45)' : undefined,
                        }}
                        title={`${formatShort(days[i])}: ${formatQuantity(v, c.unit)}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1.5 flex gap-2">
                {DAY_LETTERS.map((d, i) => (
                  <span
                    key={i}
                    className={`flex-1 text-center text-[10.5px] ${days[i] === today ? 'text-fg font-medium' : 'text-faint'}`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </List>
    </section>
  )
}
