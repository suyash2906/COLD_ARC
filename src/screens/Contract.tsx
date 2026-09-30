import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Button, IconChip, Label, List, Row, Screen, ScreenTitle, Segmented, Sheet } from '../components/ui'
import { formatLong, formatShort, toISODate } from '../lib/dates'
import { addCommitment, archiveCommitment, arcEnd, contractLocked, updateArc, updateCommitment } from '../lib/actions'
import { COMMITMENT_LIBRARY, clockToMinutes, endToDays, formatAmount, minutesToClock } from '../lib/presets'
import type { CommitmentTemplate } from '../lib/presets'
import type { ArcData } from '../state/useArc'
import type { Commitment } from '../lib/types'

function targetLabel(c: Commitment | CommitmentTemplate): string {
  if (c.kind === 'bool') return c.cadence === 'n_per_week' ? `${c.timesPerWeek}× a week` : 'Daily'
  if (c.kind === 'time') return `${c.direction === 'at_most' ? 'by' : 'after'} ${minutesToClock(c.target)}`
  return `${c.direction === 'at_most' ? 'under ' : ''}${formatAmount(c.target)} ${c.unit}`
}

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-faint shrink-0" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

const MustBadge = () => (
  <span className="bg-ember/10 text-ember shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">Must</span>
)

export default function Contract({ data }: { data: ArcData }) {
  const nav = useNavigate()
  const { arc, commitments, today } = data
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Commitment | null>(null)

  if (!arc) return null
  const active = commitments.filter((c) => !c.archivedAt)
  const endDate = arcEnd(arc)
  const locked = contractLocked(arc, today)

  // Opened directly (a reload, or a shared link) there is no history to go back to.
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))

  return (
    <Screen>
      <BackButton onClick={back} />
      <ScreenTitle
        eyebrow={arc.signedAt ? `Signed ${formatShort(toISODate(new Date(arc.signedAt)))}` : undefined}
        title="The contract"
      />

      <div
        className={`rise mb-9 rounded-[18px] px-4 py-3 text-[13.5px] leading-snug ${
          locked ? 'bg-white/[0.05] text-muted' : 'bg-ice-400/[0.08] text-ice-200'
        }`}
      >
        {locked
          ? `🔒 Locked since ${formatShort(arc.startDate)}. The terms are the terms.`
          : `Editable until ${formatLong(arc.startDate)}, when it locks for the rest of the arc.`}
      </div>

      <section>
        <Label>Window</Label>
        {locked ? (
          <List>
            <Row>
              <span className="text-muted flex-1 text-[14.5px]">
                {formatShort(arc.startDate)} → {formatShort(endDate)}
              </span>
              <span className="tnum text-[14.5px]">{arc.totalDays} days</span>
            </Row>
          </List>
        ) : (
          <>
            <List>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <label className="min-w-0 flex-1">
                  <span className="text-faint text-[12px]">From</span>
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
                    className="text-fg w-full min-w-0 bg-transparent text-[15px] outline-none"
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="text-faint text-[12px]">Until</span>
                  <input
                    type="date"
                    value={endDate}
                    min={arc.startDate}
                    onChange={(e) =>
                      e.target.value && void updateArc(arc.id, { totalDays: endToDays(arc.startDate, e.target.value) })
                    }
                    className="text-fg w-full min-w-0 bg-transparent text-[15px] outline-none"
                  />
                </label>
              </div>
            </List>
            <p className="text-faint mt-2.5 px-1 text-[12.5px]">{arc.totalDays} days.</p>
          </>
        )}
      </section>

      <section className="mt-9">
        <Label>Rules</Label>
        {locked ? (
          <List>
            {[
              ['Streak rule', arc.strictness === 'strict' ? 'Perfect days only' : '80% or better'],
              ['Grace tokens', String(arc.graceTokens)],
              ['Missed musts', '10 push-ups or squats, +5 a month'],
            ].map(([k, v]) => (
              <Row key={k}>
                <span className="text-muted flex-1 text-[14.5px]">{k}</span>
                <span className="text-[14.5px]">{v}</span>
              </Row>
            ))}
          </List>
        ) : (
          <>
            <Segmented
              value={arc.strictness}
              onChange={(s) => void updateArc(arc.id, { strictness: s })}
              options={[
                { value: 'strict', label: 'Perfect only' },
                { value: 'forgiving', label: '80% counts' },
              ]}
            />
            <div className="mt-4 flex items-center justify-between px-1">
              <span className="text-[15px]">Grace tokens</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void updateArc(arc.id, { graceTokens: Math.max(0, arc.graceTokens - 1) })}
                  className="press grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-[18px]"
                  aria-label="Fewer grace tokens"
                >
                  −
                </button>
                <span className="tnum w-5 text-center text-[17px] font-medium">{arc.graceTokens}</span>
                <button
                  onClick={() => void updateArc(arc.id, { graceTokens: Math.min(14, arc.graceTokens + 1) })}
                  className="press grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-[18px]"
                  aria-label="More grace tokens"
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mt-9">
        <Label>Commitments · {active.length}</Label>
        {active.length > 0 && (
          <List>
            {active.map((c) => (
              <Row key={c.id} onClick={locked ? undefined : () => setEditing(c)}>
                <IconChip icon={c.icon} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-medium">{c.label}</div>
                  <div className="text-faint text-[12.5px]">{targetLabel(c)}</div>
                </div>
                {c.important && <MustBadge />}
                {!locked && <Chevron />}
              </Row>
            ))}
          </List>
        )}
        {!locked && (
          <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
            + Add commitment
          </Button>
        )}
        <p className="text-faint mt-3 px-1 text-[12.5px] leading-snug">
          Miss a <span className="text-ember">Must</span> and you owe 10 push-ups or squats, 5 more each month.
        </p>
      </section>

      {adding && (
        <Sheet title="Add a commitment" onClose={() => setAdding(false)}>
          <List>
            {COMMITMENT_LIBRARY.map((t, i) => (
              <Row
                key={i}
                onClick={async () => {
                  await addCommitment(arc.id, t)
                  setAdding(false)
                }}
              >
                <IconChip icon={t.icon} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{t.label}</div>
                  <div className="text-faint text-[12.5px]">{targetLabel(t)}</div>
                </div>
                <span className="text-muted text-[20px] leading-none">+</span>
              </Row>
            ))}
          </List>
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
  const [important, setImportant] = useState(Boolean(commitment.important))

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-muted mb-1.5 block px-1 text-[13px]">Label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="field" />
      </label>

      {commitment.kind !== 'bool' && (
        <label className="block">
          <span className="text-muted mb-1.5 block px-1 text-[13px]">
            Target {commitment.unit && `(${commitment.unit})`}
          </span>
          {commitment.kind === 'time' ? (
            <input
              type="time"
              value={minutesToClock(Number(target))}
              onChange={(e) => setTarget(String(clockToMinutes(e.target.value)))}
              className="field tnum"
            />
          ) : (
            <input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="field tnum"
            />
          )}
        </label>
      )}

      <div>
        <span className="text-muted mb-1.5 block px-1 text-[13px]">Cadence</span>
        <Segmented
          value={cadence}
          onChange={setCadence}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'n_per_week', label: 'Times a week' },
          ]}
        />
        {cadence === 'n_per_week' && (
          <div className="mt-4 flex items-center justify-between px-1">
            <span className="text-muted tnum text-[14px]">{timesPerWeek}× a week</span>
            <input
              type="range"
              min={1}
              max={7}
              value={timesPerWeek}
              onChange={(e) => setTimesPerWeek(Number(e.target.value))}
              className="w-40 accent-white"
            />
          </div>
        )}
      </div>

      <button
        onClick={() => setImportant(!important)}
        className="press-row flex w-full items-center gap-3 rounded-[18px] bg-white/[0.04] px-4 py-3.5 text-left"
        role="switch"
        aria-checked={important}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">Must</div>
          <div className="text-faint text-[12.5px]">Missing it costs push-ups or squats</div>
        </div>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${important ? 'bg-ember' : 'bg-white/15'}`}
        >
          <span
            className={`bg-fg absolute top-1 h-5 w-5 rounded-full transition-all ${important ? 'left-6' : 'left-1'}`}
          />
        </span>
      </button>

      <div className="space-y-2 pt-1">
        <Button
          onClick={async () => {
            await updateCommitment(commitment.id, {
              label: label.trim() || commitment.label,
              target: Number(target) || commitment.target,
              cadence,
              timesPerWeek,
              important,
            })
            onDone()
          }}
        >
          Save
        </Button>
        <Button variant="danger" onClick={onRemove}>
          Remove from contract
        </Button>
      </div>
      <p className="text-faint text-center text-[12px] leading-snug">
        Removing archives it. Past days keep the score they earned.
      </p>
    </div>
  )
}
