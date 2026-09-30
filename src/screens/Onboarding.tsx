import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParticleField } from '../components/ParticleField'
import { BackButton, Button, IconChip, Label, List, Orb, Row } from '../components/ui'
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
  const cadence = c.cadence === 'n_per_week' ? `${c.timesPerWeek}× a week` : ''
  if (c.kind === 'bool') return cadence || 'Every day'
  const base = c.kind === 'time' ? `by ${minutesToClock(c.target)}` : `${c.direction === 'at_most' ? 'under ' : ''}${c.target} ${c.unit}`
  return cadence ? `${base} · ${cadence}` : base
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'bg-fg' : 'border-[1.5px] border-white/25'}`}
    >
      {on && <span className="bg-ink h-2 w-2 rounded-full" />}
    </span>
  )
}

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-faint shrink-0" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

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
    window.scrollTo(0, 0)
  }

  function chooseWindow(id: string, start: string, days: number) {
    setWindowId(id)
    setStartDate(start)
    setTotalDays(days)
  }

  function go(next: number) {
    setStep(next)
    window.scrollTo(0, 0)
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
    <div className="mx-auto min-h-dvh max-w-lg px-5 pt-[max(1.75rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {step === 0 && (
        <div>
          <ParticleField className="-mx-5 h-[min(380px,48dvh)]">
            <div className="flex h-full items-center justify-between px-6">
              <span className="display text-[clamp(34px,11vw,48px)]">Cold</span>
              <Orb value={100} size={96} />
              <span className="display text-[clamp(34px,11vw,48px)]">Arc</span>
            </div>
          </ParticleField>

          <div className="rise text-center">
            <h1 className="display text-[clamp(32px,9.5vw,40px)]">
              Everyone else waits
              <br />
              for January.
            </h1>
            <p className="text-muted mx-auto mt-4 max-w-[34ch] text-[16px] leading-relaxed">
              Pick your commitments, pick your window, and hold the line while the rest of the world hibernates.
            </p>
          </div>

          <section className="rise mt-12">
            <Label>Choose a contract</Label>
            <List>
              {CONTRACT_PRESETS.map((p) => (
                <Row key={p.id} onClick={() => choosePreset(p)} className="py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[16px] font-medium">{p.name}</span>
                      <span className="text-faint shrink-0 text-[12px]">
                        {p.fixedDays ? `${p.fixedDays} days` : p.commitments.length ? `${p.commitments.length} habits` : 'Empty'}
                      </span>
                    </div>
                    <p className="text-muted mt-1 text-[13.5px] leading-snug">{p.tagline}</p>
                  </div>
                  <Arrow />
                </Row>
              ))}
            </List>
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="rise">
          <BackButton onClick={() => go(0)} label="Contract" />
          <h2 className="display text-[34px]">When does it run?</h2>
          <p className="text-muted mt-3 mb-8 text-[15px] leading-relaxed">
            There is no official start date. Pick a shortcut or set your own dates.
          </p>

          {preset.fixedDays ? (
            <>
              <List>
                <label className="block px-4 py-3.5">
                  <span className="text-muted text-[12.5px]">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => e.target.value && chooseWindow('fixed', e.target.value, preset.fixedDays!)}
                    className="text-fg mt-1 w-full bg-transparent text-[17px] outline-none"
                  />
                </label>
              </List>
              <p className="text-muted mt-3 px-1 text-[13.5px]">
                {preset.name} is a fixed {preset.fixedDays}-day programme. Ends{' '}
                <span className="text-fg font-medium">{formatShort(endDate)}</span>.
              </p>
            </>
          ) : (
            <List>
              {resolvedWindows.map(({ w, r }) => (
                <Row key={w.id} onClick={() => chooseWindow(w.id, r.startDate, r.totalDays)}>
                  <Radio on={windowId === w.id} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] font-medium">{w.name}</div>
                    <div className="text-muted text-[13px]">{w.detail}</div>
                  </div>
                  <span className="tnum text-faint text-[13px]">{r.totalDays}d</span>
                </Row>
              ))}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <Radio on={windowId === 'custom'} />
                  <span className="text-[15.5px] font-medium">Custom</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="min-w-0 flex-1">
                    <span className="text-faint text-[12px]">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) =>
                        e.target.value && chooseWindow('custom', e.target.value, endToDays(e.target.value, endDate))
                      }
                      className="text-fg w-full min-w-0 bg-transparent text-[15px] outline-none"
                    />
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="text-faint text-[12px]">Until</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) =>
                        e.target.value && chooseWindow('custom', startDate, endToDays(startDate, e.target.value))
                      }
                      className="text-fg w-full min-w-0 bg-transparent text-[15px] outline-none"
                    />
                  </label>
                </div>
              </div>
            </List>
          )}

          <div className="mt-8 flex items-baseline justify-between px-1">
            <span className="text-muted text-[14px]">
              {formatShort(startDate)} → {formatShort(endDate)}
            </span>
            <span className="display tnum text-[28px]">{totalDays} days</span>
          </div>
          {startedInPast && (
            <p className="text-muted mt-2 px-1 text-[13px] leading-snug">
              Backdated start — you will land on day{' '}
              <span className="text-fg font-medium">{endToDays(startDate, today)}</span>, with the earlier days left
              open to fill in.
            </p>
          )}

          <div className="mt-8">
            <Button onClick={() => go(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rise">
          <BackButton onClick={() => go(1)} label="Window" />
          <h2 className="display text-[34px]">Your contract</h2>
          <p className="text-muted mt-3 mb-8 text-[15px] leading-relaxed">
            {commitments.length === 0
              ? 'Start empty and add your commitments once you are in.'
              : 'These are the terms. You can amend them later, but every change is recorded.'}
          </p>

          {commitments.length > 0 && (
            <List>
              {commitments.map((c, i) => (
                <Row key={i}>
                  <IconChip icon={c.icon} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15.5px] font-medium">{c.label}</div>
                    <div className="text-muted text-[12.5px]">{describeTarget(c)}</div>
                  </div>
                  <button
                    onClick={() => setCommitments(commitments.filter((_, j) => j !== i))}
                    className="press text-faint active:text-fail grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[17px] leading-none"
                    aria-label={`Remove ${c.label}`}
                  >
                    ×
                  </button>
                </Row>
              ))}
            </List>
          )}

          <section className="mt-9">
            <Label>Terms</Label>
            <dl className="divide-line-soft border-line-soft divide-y border-y text-[14px]">
              {[
                ['Window', `${formatShort(startDate)} → ${formatShort(endDate)}`],
                ['Length', `${totalDays} days`],
                ['Streak rule', preset.strictness === 'strict' ? 'Perfect days only' : '80% or better'],
                ['Grace tokens', String(preset.graceTokens)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-1 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tnum">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-8">
            <Button onClick={sign} disabled={busy}>
              {busy ? 'Signing…' : 'Sign and start'}
            </Button>
          </div>
          <p className="text-faint mt-3 text-center text-[12.5px]">Everything stays on this device. No account, no server.</p>
        </div>
      )}
    </div>
  )
}
