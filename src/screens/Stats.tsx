import { Screen, ScreenTitle, Stat, scoreColor } from '../components/ui'
import { formatShort } from '../lib/dates'
import { streakThreshold } from '../lib/scoring'
import type { ArcData } from '../state/useArc'

export default function Stats({ data }: { data: ArcData }) {
  const { arc, streaks, weeks, rates, commitments } = data
  if (!arc || !streaks) return null

  const pace = Math.round((streaks.elapsed / arc.totalDays) * 100)
  const peak = Math.max(100, ...weeks.map((w) => w.total / 7))

  return (
    <Screen>
      <ScreenTitle title="Stats" sub={`${arc.name} · ${streaks.elapsed} of ${arc.totalDays} days`} />

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Current streak" value={streaks.current} hint={`${streakThreshold(arc.strictness)}%+ to hold`} />
        <Stat label="Longest streak" value={streaks.longest} />
        <Stat label="Perfect days" value={streaks.perfectDays} hint={`of ${streaks.elapsed} elapsed`} />
        <Stat
          label="Average score"
          value={<span style={{ color: scoreColor(streaks.averageScore) }}>{streaks.averageScore}</span>}
        />
      </div>

      {arc.graceTokens > 0 && (
        <div className="card mt-2.5 flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[14px] font-medium">Grace tokens</div>
            <div className="text-faint text-[12px]">Absorb a missed day without breaking the streak</div>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: arc.graceTokens }, (_, i) => (
              <div
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${i < streaks.graceRemaining ? 'bg-gold' : 'bg-line'}`}
              />
            ))}
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-faint mb-3 text-[10px] font-semibold tracking-[0.09em] uppercase">Week by week</h2>
        {weeks.length === 0 ? (
          <p className="text-muted text-[13px]">Nothing logged yet.</p>
        ) : (
          <div className="card px-4 py-4">
            <div className="flex h-32 items-stretch gap-1.5">
              {weeks.map((w) => {
                const avg = w.total / w.days.length
                return (
                  <div key={w.weekKey} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full min-h-0 flex-1 items-end">
                      <div
                        className="w-full rounded-t-[3px] transition-all duration-500"
                        style={{
                          height: `${Math.max(3, (avg / peak) * 100)}%`,
                          background: scoreColor(Math.round(avg)),
                        }}
                        title={`${formatShort(w.weekStart)} · avg ${Math.round(avg)}`}
                      />
                    </div>
                    <span className="text-faint text-[9px]">{formatShort(w.weekStart).split(' ')[1]}</span>
                  </div>
                )
              })}
            </div>
            <div className="border-line-soft text-faint mt-3 flex justify-between border-t pt-2.5 text-[11px]">
              <span>Weekly average score</span>
              <span className="tnum">
                Best {Math.max(...weeks.map((w) => Math.round(w.total / w.days.length)))}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-faint mb-3 text-[10px] font-semibold tracking-[0.09em] uppercase">
          Where you are strong
        </h2>
        <div className="card divide-line-soft divide-y">
          {commitments
            .filter((c) => !c.archivedAt)
            .map((c) => {
              const r = rates.get(c.id)
              const rate = r?.rate ?? 0
              return (
                <div key={c.id} className="flex items-center gap-3.5 px-4 py-3">
                  <span className="text-[18px]">{c.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{c.label}</div>
                    <div className="bg-line-soft mt-1.5 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${rate}%`, background: scoreColor(rate) }}
                      />
                    </div>
                  </div>
                  <div className="tnum w-14 shrink-0 text-right">
                    <div className="text-[15px] font-semibold">{rate}%</div>
                    <div className="text-faint text-[10px]">
                      {r?.done ?? 0}/{r?.scheduled ?? 0}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </section>

      <section className="mt-8">
        <div className="card px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-medium">Arc progress</span>
            <span className="tnum text-ice-400 text-[14px] font-semibold">{pace}%</span>
          </div>
          <div className="bg-line-soft mt-2.5 h-2 overflow-hidden rounded-full">
            <div className="bg-ice-400 h-full rounded-full transition-all duration-500" style={{ width: `${pace}%` }} />
          </div>
          <p className="text-faint mt-2.5 text-[12px]">
            {arc.totalDays - streaks.elapsed > 0
              ? `${arc.totalDays - streaks.elapsed} days left in this arc.`
              : 'Arc complete.'}
          </p>
        </div>
      </section>
    </Screen>
  )
}
