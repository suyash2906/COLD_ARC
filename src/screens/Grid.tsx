import { useState } from 'react'
import { Screen, ScreenTitle, scoreColor } from '../components/ui'
import { arcDay, formatLong, fromISODate, weekdayIndex } from '../lib/dates'
import type { DayScore } from '../lib/scoring'
import type { ArcData } from '../state/useArc'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Grid({ data }: { data: ArcData }) {
  const { arc, allScores, today, streaks } = data
  const [selected, setSelected] = useState<DayScore | null>(null)

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
      <ScreenTitle
        title="The grid"
        sub={`${elapsed} behind you · ${remaining} to go`}
      />

      <div className="card px-3 py-4">
        <div className="mb-2 grid grid-cols-[1.75rem_repeat(7,1fr)] gap-1.5">
          <div />
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-faint text-center text-[10px] font-medium">
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
              <div key={ri} className="grid grid-cols-[1.75rem_repeat(7,1fr)] items-center gap-1.5">
                <div className="text-faint text-[10px] font-medium">
                  {showMonth && firstReal ? MONTHS[fromISODate(firstReal.date).getMonth()] : ''}
                </div>
                {Array.from({ length: 7 }, (_, ci) => {
                  const cell = row[ci]
                  if (!cell) return <div key={ci} className="aspect-square" />

                  const future = cell.date > today
                  const isToday = cell.date === today
                  return (
                    <button
                      key={ci}
                      onClick={() => setSelected(cell)}
                      className={`press aspect-square rounded-[5px] transition-colors ${
                        isToday ? 'ring-ice-200 ring-2 ring-offset-1 ring-offset-[var(--color-surface)]' : ''
                      } ${selected?.date === cell.date ? 'ring-fg ring-2' : ''}`}
                      style={{
                        background: future ? 'transparent' : scoreColor(cell.score, cell.touched),
                        border: future ? '1px dashed var(--color-line)' : 'none',
                      }}
                      aria-label={`${formatLong(cell.date)}: ${future ? 'upcoming' : `${cell.score}%`}`}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="border-line-soft mt-4 flex items-center justify-between border-t pt-3">
          <span className="text-faint text-[10.5px]">Missed</span>
          <div className="flex gap-1">
            {[0, 30, 60, 80, 100].map((s) => (
              <div key={s} className="h-3 w-3 rounded-[3px]" style={{ background: scoreColor(s) }} />
            ))}
          </div>
          <span className="text-faint text-[10.5px]">Perfect</span>
        </div>
      </div>

      {selected && (
        <div className="card rise mt-4 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[15px] font-semibold">{formatLong(selected.date)}</div>
              <div className="text-faint text-[12px]">Day {arcDay(arc.startDate, selected.date)}</div>
            </div>
            {selected.date > today ? (
              <span className="text-faint text-[13px]">Upcoming</span>
            ) : (
              <span className="tnum text-[22px] font-semibold" style={{ color: scoreColor(selected.score) }}>
                {selected.score}
              </span>
            )}
          </div>

          {selected.date <= today && selected.results.length > 0 && (
            <ul className="mt-3.5 space-y-1.5">
              {selected.results.map((r) => (
                <li key={r.commitment.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className={r.satisfied ? '' : 'opacity-40 grayscale'}>{r.commitment.icon}</span>
                  <span className={r.satisfied ? 'text-fg' : r.scheduled ? 'text-muted' : 'text-faint'}>
                    {r.commitment.label}
                  </span>
                  <span className="ml-auto text-[12px]">
                    {!r.scheduled ? (
                      <span className="text-faint">not due</span>
                    ) : r.satisfied ? (
                      <span className="text-ice-400">✓</span>
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
