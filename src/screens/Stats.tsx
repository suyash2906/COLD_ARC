import { IconChip, Label, List, Screen, ScreenTitle, Stat } from '../components/ui'
import { scoreColor } from '../lib/color'
import { formatShort } from '../lib/dates'
import { streakThreshold } from '../lib/scoring'
import type { ArcData } from '../state/useArc'

export default function Stats({ data }: { data: ArcData }) {
  const { arc, streaks, weeks, rates, commitments } = data
  if (!arc || !streaks) return null

  const pace = Math.round((streaks.elapsed / arc.totalDays) * 100)
  const weekAvg = weeks.map((w) => Math.round(w.total / w.days.length))
  const best = weekAvg.length ? Math.max(...weekAvg) : 0
  const bestIndex = weekAvg.lastIndexOf(best)

  const stats = [
    { label: 'Current streak', value: streaks.current, hint: `${streakThreshold(arc.strictness)}%+ keeps it` },
    { label: 'Longest streak', value: streaks.longest },
    { label: 'Perfect days', value: streaks.perfectDays, hint: `of ${streaks.elapsed} so far` },
    { label: 'Average score', value: streaks.averageScore },
  ]

  return (
    <Screen>
      <ScreenTitle eyebrow={`${arc.name} · day ${streaks.elapsed} of ${arc.totalDays}`} title="Stats" />

      {/* Numbers split by hairlines rather than boxed, like a results table. */}
      <div className="rise border-line-soft grid grid-cols-2 border-y">
        {stats.map((s, i) => (
          <Stat
            key={s.label}
            {...s}
            className={`${i % 2 === 0 ? 'border-line-soft border-r pr-4' : 'pl-5'} ${i < 2 ? 'border-line-soft border-b' : ''}`}
          />
        ))}
      </div>

      {arc.graceTokens > 0 && (
        <div className="border-line-soft flex items-center justify-between border-b px-1 py-4">
          <div>
            <div className="text-[14.5px] font-medium">Grace tokens</div>
            <div className="text-faint text-[12.5px]">Absorb a missed day without breaking the streak</div>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: arc.graceTokens }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  i < streaks.graceRemaining ? 'bg-gold shadow-[0_0_8px_rgb(255_203_92/0.6)]' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <section className="mt-10">
        <Label right={weeks.length > 0 && <span className="text-faint tnum text-[12.5px]">Best {best}</span>}>
          Week by week
        </Label>
        {weeks.length === 0 ? (
          <p className="text-muted px-1 text-[14px]">Nothing logged yet.</p>
        ) : (
          <div className="px-1">
            <div className="flex h-36 items-stretch gap-2">
              {weeks.map((w, i) => {
                const avg = weekAvg[i]
                const top = i === bestIndex && best > 0
                return (
                  <div key={w.weekKey} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full min-h-0 flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[14px] rounded-full transition-all duration-700"
                        style={{
                          height: `${Math.max(4, avg)}%`,
                          background: top ? 'var(--color-ice-300)' : 'rgb(255 255 255 / 0.16)',
                          boxShadow: top ? '0 0 16px rgb(163 224 255 / 0.5)' : undefined,
                        }}
                        title={`${formatShort(w.weekStart)} · avg ${avg}`}
                      />
                    </div>
                    <span className={`text-[10.5px] ${top ? 'text-fg' : 'text-faint'}`}>
                      {formatShort(w.weekStart).split(' ')[1]}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-faint mt-3 text-[12px]">Average score per week, by the Monday it started.</p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <Label>Where you are strong</Label>
        <List>
          {commitments
            .filter((c) => !c.archivedAt)
            .map((c) => {
              const r = rates.get(c.id)
              const rate = r?.rate ?? 0
              return (
                <div key={c.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <IconChip icon={c.icon} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{c.label}</div>
                    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${rate}%`, background: scoreColor(rate) }}
                      />
                    </div>
                  </div>
                  <div className="tnum w-14 shrink-0 text-right">
                    <div className="text-[16px] font-medium">{rate}%</div>
                    <div className="text-faint text-[11px]">
                      {r?.done ?? 0}/{r?.scheduled ?? 0}
                    </div>
                  </div>
                </div>
              )
            })}
        </List>
      </section>

      <section className="mt-10 px-1">
        <div className="flex items-baseline justify-between">
          <span className="text-muted text-[13px] font-medium">Arc progress</span>
          <span className="display tnum text-[28px]">{pace}%</span>
        </div>
        {/* A comet: the line is the arc so far, the glowing head is today. */}
        <div className="relative mt-3 h-[3px] rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-white/60 transition-all duration-700" style={{ width: `${pace}%` }} />
          <span
            className="bg-fg absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_12px_3px_rgb(163_224_255/0.7)]"
            style={{ left: `${pace}%` }}
          />
        </div>
        <p className="text-faint mt-3 text-[12.5px]">
          {arc.totalDays - streaks.elapsed > 0 ? `${arc.totalDays - streaks.elapsed} days left in this arc.` : 'Arc complete.'}
        </p>
      </section>
    </Screen>
  )
}
