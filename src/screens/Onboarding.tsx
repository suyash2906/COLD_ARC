import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { formatShort, todayISO } from '../lib/dates'
import { createArc } from '../lib/actions'
import {
  CONTRACT_PRESETS,
  WINDOW_PRESETS,
  daysToEnd,
  endToDays,
  minutesToClock,
  resolveWindow,
  type ContractPreset,
} from '../lib/presets'
import type { CommitmentTemplate } from '../lib/presets'

function describeTarget(c: CommitmentTemplate): string {
  const cadence = c.cadence === 'n_per_week' ? ` · ${c.timesPerWeek}×/week` : ''
  if (c.kind === 'bool') return `Every day${cadence}`.replace('Every day · ', '')
  if (c.kind === 'time') return `by ${minutesToClock(c.target)}${cadence}`
  const dir = c.direction === 'at_most' ? 'under' : ''
  return `${dir} ${c.target} ${c.unit}${cadence}`.trim()
}

export default function Onboarding() {
  const nav = useNavigate()
  const today = todayISO()
  const [step, setStep] = useState(0)
  const [preset, setPreset] = useState<ContractPreset>(CONTRACT_PRESETS[0])
  const [commitments, setCommitments] = useState<CommitmentTemplate[]>(CONTRACT_PRESETS[0].commitments)
  const initial = useMemo(() => resolveWindow(WINDOW_PRESETS[1], today), [today])
  const [startDate, setStartDate] = useState(initial.startDate)
  const [totalDays, setTotalDays] = useState(initial.totalDays)
  const [windowId, setWindowId] = useState<string>('classic')
  const [busy, setBusy] = useState(false)

  const endDate = useMemo(() => daysToEnd(startDate, totalDays), [startDate, totalDays])
  const resolvedWindows = useMemo(() => WINDOW_PRESETS.map((w) => ({ w, r: resolveWindow(w, today) })), [today])

  function choosePreset(p: ContractPreset) {
    setPreset(p)
    setCommitments(p.commitments)
    if (p.fixedDays) {
      setWindowId('fixed')
      setTotalDays(p.fixedDays)
      setStartDate(today)
    }
    setStep(1)
  }

  function chooseWindow(id: string, start: string, days: number) {
    setWindowId(id)
    setStartDate(start)
    setTotalDays(days)
  }

  async function sign() {
    setBusy(true)
    try {
      await createArc({
        name: preset.name,
        presetId: preset.id,
        startDate,
        totalDays,
        strictness: preset.strictness,
        graceTokens: preset.graceTokens,
        commitments,
      })
      // The app shell mounts as soon as an arc exists; land on Today rather than
      // leaving onboarding rendered inside it.
      nav('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const startedInPast = startDate < today

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {step === 0 && (
        <div className="rise">
          <div className="mt-10 mb-10">
            <div className="text-ice-400 mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">Cold Arc</div>
            <h1 className="text-[34px] leading-[1.08] font-semibold tracking-tight">
              Everyone else waits
              <br />
              for January.
            </h1>
            <p className="text-muted mt-4 text-[15px] leading-relaxed">
              Pick your commitments, pick your window, and hold the line while the rest of the world hibernates.
            </p>
          </div>

          <div className="text-faint mb-3 text-[11px] font-semibold tracking-[0.09em] uppercase">Choose a contract</div>
          <div className="space-y-2.5">
            {CONTRACT_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePreset(p)}
                className="press card border-line-soft active:border-ice-400/50 block w-full px-4 py-4 text-left"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold">{p.name}</span>
                  <span className="text-faint shrink-0 text-[11px] tracking-wide">
                    {p.fixedDays ? `${p.fixedDays} days` : p.commitments.length ? `${p.commitments.length} habits` : 'Empty'}
                  </span>
                </div>
                <p className="text-muted mt-1 text-[13px] leading-snug">{p.tagline}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rise">
          <button onClick={() => setStep(0)} className="text-muted mb-6 text-[13px]">
            ← Contract
          </button>
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight">When does it run?</h2>
          <p className="text-muted mt-2 mb-6 text-[14px] leading-relaxed">
            There is no official start date. Pick a shortcut or set your own dates.
          </p>

          {preset.fixedDays ? (
            <div className="space-y-4">
              <div className="card px-4 py-4">
                <label className="text-faint text-[11px] font-semibold tracking-[0.09em] uppercase">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => e.target.value && chooseWindow('fixed', e.target.value, preset.fixedDays!)}
                  className="text-fg mt-2 w-full bg-transparent text-[17px] outline-none"
                />
              </div>
              <p className="text-muted text-[13px]">
                {preset.name} is a fixed {preset.fixedDays}-day programme. Ends{' '}
                <span className="text-fg font-medium">{formatShort(endDate)}</span>.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {resolvedWindows.map(({ w, r }) => (
                  <button
                    key={w.id}
                    onClick={() => chooseWindow(w.id, r.startDate, r.totalDays)}
                    className={`press card block w-full px-4 py-3.5 text-left ${
                      windowId === w.id ? 'border-ice-400/60 bg-ice-400/[0.07]' : 'border-line-soft'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold">{w.name}</div>
                        <div className="text-muted mt-0.5 text-[12.5px]">{w.detail}</div>
                      </div>
                      <div className="tnum text-faint shrink-0 text-[12px]">{r.totalDays}d</div>
                    </div>
                  </button>
                ))}
              </div>

              <div
                className={`card mt-2.5 px-4 py-3.5 ${windowId === 'custom' ? 'border-ice-400/60' : 'border-line-soft'}`}
              >
                <div className="mb-3 text-[15px] font-semibold">Custom</div>
                <div className="flex items-center gap-3">
                  <label className="flex-1">
                    <span className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) =>
                        e.target.value && chooseWindow('custom', e.target.value, endToDays(e.target.value, endDate))
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
                      min={startDate}
                      onChange={(e) =>
                        e.target.value && chooseWindow('custom', startDate, endToDays(startDate, e.target.value))
                      }
                      className="text-fg mt-1 w-full bg-transparent text-[15px] outline-none"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="card mt-5 px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-muted text-[13px]">
                {formatShort(startDate)} → {formatShort(endDate)}
              </span>
              <span className="tnum text-ice-400 text-[15px] font-semibold">{totalDays} days</span>
            </div>
            {startedInPast && (
              <p className="text-muted mt-2.5 border-t border-line-soft pt-2.5 text-[12.5px] leading-snug">
                Backdated start — you will land on day{' '}
                <span className="text-fg font-medium">{endToDays(startDate, today)}</span>, with the earlier days left
                open to fill in.
              </p>
            )}
          </div>

          <div className="mt-6">
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rise">
          <button onClick={() => setStep(1)} className="text-muted mb-6 text-[13px]">
            ← Window
          </button>
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight">Your contract</h2>
          <p className="text-muted mt-2 mb-6 text-[14px] leading-relaxed">
            {commitments.length === 0
              ? 'Start empty and add your commitments once you are in.'
              : 'These are the terms. You can amend them later, but every change is recorded.'}
          </p>

          <div className="space-y-2">
            {commitments.map((c, i) => (
              <div key={i} className="card flex items-center gap-3 px-4 py-3">
                <span className="text-[19px]">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{c.label}</div>
                  <div className="text-muted text-[12px]">{describeTarget(c)}</div>
                </div>
                <button
                  onClick={() => setCommitments(commitments.filter((_, j) => j !== i))}
                  className="text-faint active:text-fail shrink-0 px-1 text-[18px] leading-none"
                  aria-label={`Remove ${c.label}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="card mt-5 px-4 py-4">
            <div className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Terms</div>
            <dl className="mt-2.5 space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Window</dt>
                <dd>
                  {formatShort(startDate)} → {formatShort(endDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Length</dt>
                <dd className="tnum">{totalDays} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Streak rule</dt>
                <dd>{preset.strictness === 'strict' ? 'Perfect days only' : '80% or better'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Grace tokens</dt>
                <dd className="tnum">{preset.graceTokens}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6">
            <Button onClick={sign} disabled={busy}>
              {busy ? 'Signing…' : 'Sign and start'}
            </Button>
          </div>
          <p className="text-faint mt-3 text-center text-[12px]">
            Everything stays on this device until you join a squad.
          </p>
        </div>
      )}
    </div>
  )
}
