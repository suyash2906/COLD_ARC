import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Screen, ScreenTitle } from '../components/ui'
import { formatShort, todayISO } from '../lib/dates'
import { addCommitment, archiveCommitment, arcEnd, updateArc, updateCommitment } from '../lib/actions'
import { COMMITMENT_LIBRARY, clockToMinutes, endToDays, minutesToClock } from '../lib/presets'
import type { CommitmentTemplate } from '../lib/presets'
import type { ArcData } from '../state/useArc'
import type { Commitment } from '../lib/types'

function targetLabel(c: Commitment | CommitmentTemplate): string {
  if (c.kind === 'bool') return c.cadence === 'n_per_week' ? `${c.timesPerWeek}×/week` : 'Daily'
  if (c.kind === 'time') return `${c.direction === 'at_most' ? 'by' : 'after'} ${minutesToClock(c.target)}`
  return `${c.direction === 'at_most' ? 'under ' : ''}${c.target} ${c.unit}`
}

export default function Contract({ data }: { data: ArcData }) {
  const nav = useNavigate()
  const { arc, commitments } = data
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Commitment | null>(null)

  if (!arc) return null
  const active = commitments.filter((c) => !c.archivedAt)
  const endDate = arcEnd(arc)

  return (
    <Screen>
      <button onClick={() => nav(-1)} className="text-muted mb-5 text-[13px]">
        ← Back
      </button>
      <ScreenTitle
        title="The contract"
        sub={arc.signedAt ? `Signed ${formatShort(todayISO())}` : undefined}
      />

      <section className="card px-4 py-4">
        <div className="text-faint mb-3 text-[10px] font-semibold tracking-[0.09em] uppercase">Window</div>
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">From</span>
            <input
              type="date"
              value={arc.startDate}
              onChange={(e) =>
                e.target.value &&
                void updateArc(arc.id, {
                  startDate: e.target.value,
                  totalDays: endToDays(e.target.value, endDate),
                })
              }
              className="text-fg mt-1 w-full bg-transparent text-[15px] outline-none"
            />
          </label>
          <span className="text-faint mt-4">→</span>
          <label className="flex-1">
            <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Until</span>
            <input
              type="date"
              value={endDate}
              min={arc.startDate}
              onChange={(e) =>
                e.target.value && void updateArc(arc.id, { totalDays: endToDays(arc.startDate, e.target.value) })
              }
              className="text-fg mt-1 w-full bg-transparent text-[15px] outline-none"
            />
          </label>
        </div>
        <p className="text-faint border-line-soft mt-3 border-t pt-3 text-[12px]">
          {arc.totalDays} days. Extending the end date is normal — plenty of arcs run into February.
        </p>
      </section>

      <section className="card mt-2.5 px-4 py-4">
        <div className="text-faint mb-3 text-[10px] font-semibold tracking-[0.09em] uppercase">Rules</div>
        <div className="flex gap-2">
          {(['strict', 'forgiving'] as const).map((s) => (
            <button
              key={s}
              onClick={() => void updateArc(arc.id, { strictness: s })}
              className={`press flex-1 rounded-xl border px-3 py-2.5 text-[13px] ${
                arc.strictness === s ? 'border-ice-400 bg-ice-400/10 text-ice-300' : 'border-line text-muted'
              }`}
            >
              {s === 'strict' ? 'Perfect only' : '80% counts'}
            </button>
          ))}
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-[13px]">Grace tokens</span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => void updateArc(arc.id, { graceTokens: Math.max(0, arc.graceTokens - 1) })}
              className="press bg-surface-2 border-line grid h-7 w-7 place-items-center rounded-full border"
            >
              −
            </button>
            <span className="tnum w-4 text-center text-[15px] font-semibold">{arc.graceTokens}</span>
            <button
              onClick={() => void updateArc(arc.id, { graceTokens: Math.min(14, arc.graceTokens + 1) })}
              className="press bg-surface-2 border-line grid h-7 w-7 place-items-center rounded-full border"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="text-faint mb-2.5 text-[10px] font-semibold tracking-[0.09em] uppercase">
          Commitments · {active.length}
        </div>
        <div className="space-y-2">
          {active.map((c) => (
            <button
              key={c.id}
              onClick={() => setEditing(c)}
              className="press card flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
            >
              <span className="text-[20px]">{c.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{c.label}</div>
                <div className="text-faint text-[12px]">{targetLabel(c)}</div>
              </div>
              <span className="text-faint text-[13px]">Edit</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setAdding(true)}
          className="press card border-line active:border-ice-400/50 text-ice-400 mt-2 w-full border-dashed px-4 py-3.5 text-[14px] font-medium"
        >
          + Add commitment
        </button>
      </section>

      {adding && (
        <Sheet title="Add a commitment" onClose={() => setAdding(false)}>
          <div className="space-y-2">
            {COMMITMENT_LIBRARY.map((t, i) => (
              <button
                key={i}
                onClick={async () => {
                  await addCommitment(arc.id, t)
                  setAdding(false)
                }}
                className="press card flex w-full items-center gap-3.5 px-4 py-3 text-left"
              >
                <span className="text-[19px]">{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-medium">{t.label}</div>
                  <div className="text-faint text-[12px]">{targetLabel(t)}</div>
                </div>
                <span className="text-ice-400 text-[18px] leading-none">+</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet title={editing.label} onClose={() => setEditing(null)}>
          <CommitmentEditor
            commitment={editing}
            onDone={() => setEditing(null)}
            onRemove={async () => {
              await archiveCommitment(editing.id)
              setEditing(null)
            }}
          />
        </Sheet>
      )}
    </Screen>
  )
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="bg-surface border-line relative max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted text-[20px] leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CommitmentEditor({
  commitment,
  onDone,
  onRemove,
}: {
  commitment: Commitment
  onDone: () => void
  onRemove: () => void
}) {
  const [label, setLabel] = useState(commitment.label)
  const [target, setTarget] = useState(String(commitment.target))
  const [timesPerWeek, setTimesPerWeek] = useState(commitment.timesPerWeek)
  const [cadence, setCadence] = useState(commitment.cadence)

  const field = 'bg-surface-2 border-line text-fg w-full rounded-xl border px-3.5 py-3 text-[15px] outline-none'

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={`${field} mt-1.5`} />
      </label>

      {commitment.kind !== 'bool' && (
        <label className="block">
          <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">
            Target {commitment.unit && `(${commitment.unit})`}
          </span>
          {commitment.kind === 'time' ? (
            <input
              type="time"
              value={minutesToClock(Number(target))}
              onChange={(e) => setTarget(String(clockToMinutes(e.target.value)))}
              className={`${field} tnum mt-1.5`}
            />
          ) : (
            <input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={`${field} tnum mt-1.5`}
            />
          )}
        </label>
      )}

      <div>
        <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Cadence</span>
        <div className="mt-1.5 flex gap-2">
          {(['daily', 'n_per_week'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              className={`press flex-1 rounded-xl border px-3 py-2.5 text-[13px] ${
                cadence === c ? 'border-ice-400 bg-ice-400/10 text-ice-300' : 'border-line text-muted'
              }`}
            >
              {c === 'daily' ? 'Every day' : 'Times per week'}
            </button>
          ))}
        </div>
        {cadence === 'n_per_week' && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted text-[13px]">{timesPerWeek}× per week</span>
            <input
              type="range"
              min={1}
              max={7}
              value={timesPerWeek}
              onChange={(e) => setTimesPerWeek(Number(e.target.value))}
              className="accent-ice-400 w-40"
            />
          </div>
        )}
      </div>

      <Button
        onClick={async () => {
          await updateCommitment(commitment.id, {
            label: label.trim() || commitment.label,
            target: Number(target) || commitment.target,
            cadence,
            timesPerWeek,
          })
          onDone()
        }}
      >
        Save
      </Button>
      <Button variant="danger" onClick={onRemove}>
        Remove from contract
      </Button>
      <p className="text-faint text-center text-[11.5px] leading-snug">
        Removing archives it. Past days keep the score they earned.
      </p>
    </div>
  )
}
