import { useEffect, useRef, useState } from 'react'
import { setLogValue, toggleCommitment } from '../lib/actions'
import { clockToMinutes, formatAmount, minutesToClock } from '../lib/presets'
import type { CommitmentResult } from '../lib/scoring'
import type { Arc } from '../lib/types'
import { IconChip } from './ui'

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
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-300 ${
        on
          ? 'bg-fg shadow-[0_0_18px_rgb(163_224_255/0.45)]'
          : dim
            ? 'border border-white/10'
            : 'border-[1.5px] border-white/25'
      }`}
    >
      {on && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </div>
  )
}

/** "miss = 10 push-ups", shown on musts so the cost is in view while you still can avoid it. */
function Cost({ penalty, lead = true }: { penalty?: string; lead?: boolean }) {
  if (!penalty) return null
  return (
    <span className="text-ember/85">
      {lead && ' · '}miss = {penalty}
    </span>
  )
}

/** One commitment as a row inside the day's list. Rows carry no box of their own. */
export function CommitmentRow({
  arc,
  result,
  date,
  penalty,
}: {
  arc: Arc
  result: CommitmentResult
  date: string
  /** What missing this costs, for musts that are due. */
  penalty?: string
}) {
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
  // Only warn while it can still be saved.
  const cost = satisfied || optional ? undefined : penalty

  const hint = (() => {
    if (c.kind === 'bool') return optional ? 'Optional today' : c.cadence === 'n_per_week' ? `${c.timesPerWeek}× a week` : ''
    if (c.kind === 'time') return `${c.direction === 'at_most' ? 'by' : 'after'} ${minutesToClock(c.target)}`
    const dir = c.direction === 'at_most' ? 'under ' : ''
    return `${dir}${formatAmount(c.target)} ${c.unit}`
  })()

  if (c.kind === 'bool') {
    return (
      <button
        onClick={() => void toggleCommitment(arc, c, date, !satisfied)}
        className="press-row flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <IconChip icon={c.icon} dim={optional && !satisfied} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15.5px] font-medium ${optional && !satisfied ? 'text-muted' : ''}`}>{c.label}</div>
          {(hint || cost) && (
            <div className="text-faint text-[12.5px]">
              {hint}
              <Cost penalty={cost} lead={Boolean(hint)} />
            </div>
          )}
        </div>
        <Check on={satisfied} dim={optional} />
      </button>
    )
  }

  if (c.kind === 'time') {
    return (
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <IconChip icon={c.icon} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium">{c.label}</div>
          <div className="text-faint text-[12.5px]">
            {hint}
            <Cost penalty={cost} />
          </div>
        </div>
        <input
          type="time"
          value={value === null ? '' : minutesToClock(value)}
          onChange={(e) => commit(e.target.value ? clockToMinutes(e.target.value) : null)}
          aria-label={`${c.label} time`}
          className={`tnum rounded-full px-3.5 py-1.5 text-[15px] outline-none ${
            satisfied ? 'bg-fg text-ink' : 'text-fg bg-white/[0.07]'
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
    <div className="relative px-4 py-3.5">
      {/* A hairline of progress along the bottom edge, instead of filling the whole row. */}
      <div className="absolute inset-x-4 bottom-0 h-px overflow-hidden" aria-hidden>
        <div
          className="bg-ice-300 h-full shadow-[0_0_8px_rgb(163_224_255/0.8)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3.5">
        <IconChip icon={c.icon} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium">{c.label}</div>
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
              className="text-ice-300 tnum w-24 bg-transparent text-[12.5px] outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(value === null ? '' : trim(value))
                setEditing(true)
              }}
              className="tnum text-faint text-[12.5px]"
            >
              <span className={satisfied ? 'text-ice-300' : value !== null ? 'text-muted' : ''}>
                {value === null ? '—' : formatAmount(value)}
              </span>
              {' / '}
              {hint}
              <Cost penalty={cost} />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => commit(Math.max(0, current - step) || null)}
            disabled={value === null}
            className="press text-fg grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-[18px] leading-none disabled:opacity-30"
            aria-label={`Decrease ${c.label}`}
          >
            −
          </button>
          <button
            onClick={() => commit(current + step)}
            className={`press grid h-9 w-9 place-items-center rounded-full text-[18px] leading-none ${
              satisfied ? 'bg-fg text-ink' : 'text-fg bg-white/[0.07]'
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
