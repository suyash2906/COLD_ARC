import { useEffect, useRef, useState } from 'react'
import { setLogValue, toggleCommitment } from '../lib/actions'
import { clockToMinutes, minutesToClock } from '../lib/presets'
import type { CommitmentResult } from '../lib/scoring'
import type { Arc } from '../lib/types'

/** Step size that feels right whether the target is 3.8 litres or 10,000 steps. */
function stepFor(target: number): number {
  if (target <= 5) return 0.5
  if (target <= 100) return 5
  if (target <= 1000) return 50
  return 500
}

const trim = (n: number) => Number(n.toFixed(2)).toString()

function Check({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <div
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 ${
        on ? 'border-ice-400 bg-ice-400' : dim ? 'border-line' : 'border-faint'
      }`}
    >
      {on && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </div>
  )
}

export function CommitmentRow({ arc, result, date }: { arc: Arc; result: CommitmentResult; date: string }) {
  const { commitment: c, satisfied, value, scheduled, fraction } = result
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = (v: number | null) => void setLogValue(arc, c, date, v)

  // An n_per_week commitment that isn't required today is shown, but muted — you can
  // still log it, it just isn't held against you.
  const optional = !scheduled

  const hint = (() => {
    if (c.kind === 'bool') return optional ? 'Optional today' : c.cadence === 'n_per_week' ? `${c.timesPerWeek}×/week` : ''
    if (c.kind === 'time') return `${c.direction === 'at_most' ? 'by' : 'after'} ${minutesToClock(c.target)}`
    const dir = c.direction === 'at_most' ? 'under ' : ''
    return `${dir}${trim(c.target)} ${c.unit}`
  })()

  if (c.kind === 'bool') {
    return (
      <button
        onClick={() => void toggleCommitment(arc, c, date, !satisfied)}
        className={`press card flex w-full items-center gap-3.5 px-4 py-3.5 text-left ${
          satisfied ? 'border-ice-400/25 bg-ice-400/[0.06]' : ''
        }`}
      >
        <span className={`text-[20px] ${optional && !satisfied ? 'opacity-45' : ''}`}>{c.icon}</span>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-medium ${optional && !satisfied ? 'text-muted' : ''}`}>{c.label}</div>
          {hint && <div className="text-faint text-[12px]">{hint}</div>}
        </div>
        <Check on={satisfied} dim={optional} />
      </button>
    )
  }

  if (c.kind === 'time') {
    return (
      <div className={`card flex items-center gap-3.5 px-4 py-3.5 ${satisfied ? 'border-ice-400/25 bg-ice-400/[0.06]' : ''}`}>
        <span className="text-[20px]">{c.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{c.label}</div>
          <div className="text-faint text-[12px]">{hint}</div>
        </div>
        <input
          type="time"
          value={value === null ? '' : minutesToClock(value)}
          onChange={(e) => commit(e.target.value ? clockToMinutes(e.target.value) : null)}
          className={`tnum bg-surface-2 border-line rounded-lg border px-2.5 py-1.5 text-[15px] outline-none ${
            satisfied ? 'text-ice-300' : 'text-fg'
          }`}
        />
      </div>
    )
  }

  // count | duration
  const step = stepFor(c.target)
  const current = value ?? 0
  const pct = Math.round(fraction * 100)

  return (
    <div className={`card relative overflow-hidden px-4 py-3.5 ${satisfied ? 'border-ice-400/25' : ''}`}>
      {/* Fill bar reads progress at a glance without adding another element to scan. */}
      <div
        className="bg-ice-400/[0.09] absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3.5">
        <span className="text-[20px]">{c.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{c.label}</div>
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                setEditing(false)
                const n = parseFloat(draft)
                commit(Number.isFinite(n) && n >= 0 ? n : null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.blur()}
              className="text-ice-300 tnum w-24 bg-transparent text-[12px] outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(value === null ? '' : trim(value))
                setEditing(true)
              }}
              className="tnum text-faint text-[12px]"
            >
              <span className={satisfied ? 'text-ice-300' : value !== null ? 'text-muted' : ''}>
                {value === null ? '—' : trim(value)}
              </span>
              {' / '}
              {hint}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => commit(Math.max(0, current - step) || null)}
            disabled={value === null}
            className="press bg-surface-2 border-line text-fg grid h-8 w-8 place-items-center rounded-full border text-[17px] leading-none disabled:opacity-30"
            aria-label={`Decrease ${c.label}`}
          >
            −
          </button>
          <button
            onClick={() => commit(current + step)}
            className={`press grid h-8 w-8 place-items-center rounded-full border text-[17px] leading-none ${
              satisfied ? 'border-ice-400 bg-ice-400 text-ink' : 'bg-surface-2 border-line text-fg'
            }`}
            aria-label={`Increase ${c.label}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
