import type { ReactNode } from 'react'

/** Score -> colour ramp. Shared by the ring, the grid and the leaderboard so a
 *  given number always looks the same wherever it appears. */
export function scoreColor(score: number, touched = true): string {
  if (!touched && score === 0) return 'var(--color-line-soft)'
  if (score >= 100) return 'var(--color-ice-300)'
  if (score >= 80) return 'var(--color-ice-400)'
  if (score >= 60) return 'var(--color-ice-500)'
  if (score >= 30) return 'var(--color-ice-600)'
  if (score > 0) return '#0b4f70'
  return 'var(--color-line)'
}

export function Ring({
  value,
  size = 168,
  stroke = 12,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(pct)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 520ms var(--ease-out-quint), stroke 320ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    // pb clears the fixed tab bar plus the home indicator.
    <div className={`min-h-dvh px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-36 ${className}`}>{children}</div>
  )
}

export function ScreenTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[27px] leading-none font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-muted mt-1.5 text-[13px]">{sub}</p>}
      </div>
      {right}
    </header>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">{label}</div>
      <div className="tnum mt-1 text-[26px] leading-none font-semibold">{value}</div>
      {hint && <div className="text-muted mt-1 text-[11px]">{hint}</div>}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const styles = {
    primary: 'bg-ice-400 text-ink font-semibold active:bg-ice-300 disabled:bg-line disabled:text-faint',
    ghost: 'bg-surface-2 text-fg border border-line active:bg-line',
    danger: 'bg-transparent text-fail border border-fail/35 active:bg-fail/10',
  }[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press w-full rounded-xl px-4 py-3.5 text-[15px] disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rise grid place-items-center py-16 text-center">
      <div className="mb-3 text-4xl opacity-70">{icon}</div>
      <p className="text-fg text-[15px] font-medium">{title}</p>
      <p className="text-muted mt-1.5 max-w-[30ch] text-[13px] leading-relaxed">{body}</p>
    </div>
  )
}

export function Flame({ count }: { count: number }) {
  const lit = count > 0
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        lit ? 'border-ember/30 bg-ember/10' : 'border-line bg-surface'
      }`}
    >
      <span className={`text-[13px] ${lit ? '' : 'opacity-40 grayscale'}`}>🔥</span>
      <span className={`tnum text-[14px] font-semibold ${lit ? 'text-ember' : 'text-faint'}`}>{count}</span>
    </div>
  )
}
