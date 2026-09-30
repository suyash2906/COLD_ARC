import { useEffect, useRef, useState, type RefObject } from 'react'
import { setLogValue, toggleCommitment } from '../lib/actions'
import { clockToMinutes, formatQuantity, minutesToClock } from '../lib/presets'
import type { CommitmentResult } from '../lib/scoring'
import type { Arc, Commitment } from '../lib/types'
import { IconChip } from './ui'

const trim = (n: number) => Number(n.toFixed(2)).toString()

/** Slider range and step: fine enough for 250 ml of water, coarse enough for 8,000 steps. */
function sliderSpec(c: Commitment): { step: number; max: number } {
  const step = c.unit === 'L' || c.target <= 5 ? 0.25 : c.target <= 100 ? 5 : c.target <= 1000 ? 25 : 100
  const room = c.direction === 'at_most' ? c.target * 2 : c.target * 1.5
  return { step, max: Math.ceil(room / step) * step }
}

// Grow for 1s, hold for 0.5s, settle over 0.75s: "this one is still waiting on you".
const NUDGE_MS = 2250
const NUDGE_EASE = 'cubic-bezier(0.45, 0, 0.25, 1)'
const NUDGE_FRAMES: Keyframe[] = [
  { transform: 'scale(1)', backgroundColor: 'rgb(255 154 82 / 0)', easing: NUDGE_EASE },
  { transform: 'scale(1.045)', backgroundColor: 'rgb(255 154 82 / 0.07)', offset: 1000 / NUDGE_MS },
  { transform: 'scale(1.045)', backgroundColor: 'rgb(255 154 82 / 0.07)', offset: 1500 / NUDGE_MS, easing: NUDGE_EASE },
  { transform: 'scale(1)', backgroundColor: 'rgb(255 154 82 / 0)' },
]

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
  nudge = 0,
  nudgeDelay = 0,
}: {
  arc: Arc
  result: CommitmentResult
  date: string
  /** What missing this costs, for musts that are due. */
  penalty?: string
  /** Bump this to play the "still to do" zoom once. Zero means leave it alone. */
  nudge?: number
  nudgeDelay?: number
}) {
  const { commitment: c, satisfied, value, scheduled } = result
  const rootRef = useRef<HTMLDivElement & HTMLButtonElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!nudge || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = el.animate(NUDGE_FRAMES, { duration: NUDGE_MS, delay: nudgeDelay })
    return () => animation.cancel()
  }, [nudge, nudgeDelay])

  const commit = (v: number | null) => void setLogValue(arc, c, date, v)

  // An n_per_week commitment that isn't required today is shown, but muted — you can
  // still log it, it just isn't held against you.
  const optional = !scheduled
  // Only warn while it can still be saved.
  const cost = satisfied || optional ? undefined : penalty

  if (c.kind === 'bool') {
    const hint = optional ? 'Optional today' : c.cadence === 'n_per_week' ? `${c.timesPerWeek}× a week` : ''
    return (
      <button
        ref={rootRef}
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
      <div ref={rootRef} className="flex items-center gap-3.5 px-4 py-3.5">
        <IconChip icon={c.icon} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium">{c.label}</div>
          <div className="text-faint text-[12.5px]">
            {c.direction === 'at_most' ? 'by' : 'after'} {minutesToClock(c.target)}
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

  return <AmountRow rootRef={rootRef} commit={commit} result={result} cost={cost} />
}

/** count | duration: drag a slider to the amount, or tap the number to type it. */
function AmountRow({
  rootRef,
  commit,
  result,
  cost,
}: {
  rootRef: RefObject<(HTMLDivElement & HTMLButtonElement) | null>
  commit: (v: number | null) => void
  result: CommitmentResult
  cost?: string
}) {
  const { commitment: c, satisfied, value } = result
  const { step, max } = sliderSpec(c)
  const [slide, setSlide] = useState<number | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // A saved value (or a Health sync) replaces whatever the slider was showing.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setSlide(null)
  }

  useEffect(() => {
    if (typing !== null) inputRef.current?.focus()
  }, [typing])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const shown = slide ?? value ?? 0
  const save = (v: number) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    commit(v > 0 ? v : null)
  }
  // Save shortly after the finger stops, so dragging doesn't write on every pixel.
  const move = (v: number) => {
    setSlide(v)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(v), 350)
  }

  const over = c.direction === 'at_most' && shown > c.target
  const fill = satisfied && !over ? 'var(--color-ice-300)' : over ? 'var(--color-fail)' : 'rgb(255 255 255 / 0.7)'
  const pct = Math.min(100, (shown / max) * 100)
  const goal = Math.min(1, c.target / max)

  return (
    <div ref={rootRef} className="px-4 pt-3.5 pb-2.5">
      <div className="flex items-center gap-3.5">
        <IconChip icon={c.icon} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium">{c.label}</div>
          <div className="text-faint text-[12.5px]">
            {c.direction === 'at_most' ? 'under' : 'goal'} {formatQuantity(c.target, c.unit)}
            <Cost penalty={cost} />
          </div>
        </div>
        {typing !== null ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            onBlur={() => {
              const n = parseFloat(typing)
              setTyping(null)
              save(Number.isFinite(n) && n >= 0 ? n : 0)
            }}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.blur()}
            className="tnum w-20 shrink-0 rounded-full bg-white/[0.07] px-3 py-1 text-right text-[15px] outline-none"
          />
        ) : (
          <button
            onClick={() => setTyping(value === null ? '' : trim(value))}
            className={`tnum shrink-0 text-[15px] font-medium ${over ? 'text-fail' : satisfied ? 'text-ice-300' : shown ? 'text-fg' : 'text-faint'}`}
            aria-label={`Type an amount for ${c.label}`}
          >
            {shown ? formatQuantity(shown, c.unit) : '—'}
          </button>
        )}
      </div>

      <div className="relative mt-1 ml-[50px]">
        {/* Where the goal sits on the track. */}
        <span
          className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/35"
          style={{ left: `calc(12px + (100% - 24px) * ${goal})` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={shown}
          onChange={(e) => move(Number(e.target.value))}
          onPointerUp={() => slide !== null && save(slide)}
          onTouchEnd={() => slide !== null && save(slide)}
          aria-label={c.label}
          className="range"
          style={{ ['--pct' as string]: `${pct}%`, ['--fill' as string]: fill }}
        />
      </div>
    </div>
  )
}
