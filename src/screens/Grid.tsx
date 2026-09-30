import { useEffect, useRef, useState } from 'react'
import { Screen, ScreenTitle } from '../components/ui'
import { scoreColor } from '../lib/color'
import { arcDay, formatLong, fromISODate, weekdayIndex } from '../lib/dates'
import type { DayScore } from '../lib/scoring'
import type { ArcData } from '../state/useArc'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * One dot per day, like a star chart: the better the day, the bigger and brighter the
 * dot. Perfect days glow. Days not reached yet are pinpricks.
 */
function Dot({ cell, future }: { cell: DayScore; future: boolean }) {
  if (future) return <span className="h-1 w-1 rounded-full bg-white/15" />
  if (!cell.touched && cell.score === 0) return <span className="h-1.5 w-1.5 rounded-full bg-white/25" />

  const size = 30 + (cell.score / 100) * 52
  return (
    <span
      className="rounded-full transition-all duration-500"
      style={{
        width: `${size}%`,
        height: `${size}%`,
        background: scoreColor(cell.score, cell.touched),
        boxShadow: cell.perfect ? '0 0 14px 2px rgb(163 224 255 / 0.55)' : undefined,
      }}
    />
  )
}

export default function Grid({ data }: { data: ArcData }) {
  const { arc, allScores, today, streaks } = data
  const [selected, setSelected] = useState<DayScore | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // The detail sits under a long grid, so bring it into view instead of leaving it off-screen.
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  if (!arc || !streaks) return null

  // Pad so the first day lands under its real weekday column.
  const lead = weekdayIndex(arc.startDate)
  const cells: (DayScore | null)[] = [...Array<null>(lead).fill(null), ...allScores]
  const rows: (DayScore | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  const elapsed = streaks.elapsed
  const remaining = Math.max(0, arc.totalDays - elapsed)

  return (
    <Screen>
      <ScreenTitle eyebrow={`${elapsed} behind you · ${remaining} to go`} title="The grid" />

      <div className="rise">
        <div className="mb-3 grid grid-cols-[2rem_repeat(7,1fr)] gap-1.5">
          <div />
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-faint text-center text-[11px] font-medium">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {rows.map((row, ri) => {
            // Label a row with the month whenever a new one starts inside it.
            const firstReal = row.find(Boolean)
            const showMonth =
              firstReal &&
              (ri === 0 ||
                fromISODate(firstReal.date).getMonth() !==
                  fromISODate(rows[ri - 1].find(Boolean)?.date ?? firstReal.date).getMonth())

            return (
              <div key={ri} className="grid grid-cols-[2rem_repeat(7,1fr)] items-center gap-1.5">
                <div className="text-muted text-[11px] font-medium">
                  {showMonth && firstReal ? MONTHS[fromISODate(firstReal.date).getMonth()] : ''}
                </div>
                {Array.from({ length: 7 }, (_, ci) => {
                  const cell = row[ci]
                  if (!cell) return <div key={ci} className="aspect-square" />

                  const future = cell.date > today
                  const isToday = cell.date === today
                  const isSelected = selected?.date === cell.date
                  return (
                    <button
                      key={ci}
                      onClick={() => setSelected(isSelected ? null : cell)}
                      className={`press grid aspect-square place-items-center rounded-full ${
                        isSelected ? 'bg-white/[0.12]' : isToday ? 'ring-1 ring-white/50' : ''
                      }`}
                      aria-label={`${formatLong(cell.date)}: ${future ? 'upcoming' : `${cell.score}%`}`}
                    >
                      <Dot cell={cell} future={future} />
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="border-line-soft mt-6 flex items-center justify-between border-t px-1 pt-4">
          <span className="text-faint text-[12px]">Missed</span>
          <div className="flex items-center gap-3">
            {[10, 40, 70, 90, 100].map((s) => (
              <span
                key={s}
                className="rounded-full"
                style={{
                  width: 4 + s / 14,
                  height: 4 + s / 14,
                  background: scoreColor(s),
                  boxShadow: s === 100 ? '0 0 10px rgb(163 224 255 / 0.6)' : undefined,
                }}
              />
            ))}
          </div>
          <span className="text-faint text-[12px]">Perfect</span>
        </div>
      </div>

      {selected && (
        <div
          ref={detailRef}
          className="rise bg-surface mt-6 scroll-mb-28 rounded-[22px] border border-white/[0.05] px-4 py-4"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[16px] font-medium">{formatLong(selected.date)}</div>
              <div className="text-faint text-[12.5px]">Day {arcDay(arc.startDate, selected.date)}</div>
            </div>
            {selected.date > today ? (
              <span className="text-faint text-[13px]">Upcoming</span>
            ) : (
              <span className="display tnum text-[30px]">{selected.score}</span>
            )}
          </div>

          {selected.date <= today && selected.results.length > 0 && (
            <ul className="divide-line-soft border-line-soft mt-3 divide-y border-t">
              {selected.results.map((r) => (
                <li key={r.commitment.id} className="flex items-center gap-2.5 py-2.5 text-[14px]">
                  <span className={r.satisfied ? '' : 'opacity-40 grayscale'}>{r.commitment.icon}</span>
                  <span className={r.satisfied ? 'text-fg' : r.scheduled ? 'text-muted' : 'text-faint'}>
                    {r.commitment.label}
                  </span>
                  <span className="ml-auto text-[12.5px]">
                    {!r.scheduled ? (
                      <span className="text-faint">not due</span>
                    ) : r.satisfied ? (
                      <span className="text-ice-300">Done</span>
                    ) : (
                      <span className="text-faint tnum">{Math.round(r.fraction * 100)}%</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Screen>
  )
}
