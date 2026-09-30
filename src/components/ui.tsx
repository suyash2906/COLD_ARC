import { useState, type ReactNode } from 'react'

/**
 * The day's score as a small sun: a dark moon at 0, fully lit and glowing at 100. It
 * breathes slowly, and flares once whenever the score goes up.
 */
export function Orb({ value, size = 104 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const t = pct / 100
  const [prev, setPrev] = useState(pct)
  const [flares, setFlares] = useState(0)
  if (pct !== prev) {
    if (pct > prev) setFlares((n) => n + 1)
    setPrev(pct)
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <div
        className="absolute rounded-full"
        style={{
          inset: -size * 0.9,
          opacity: 0.3 + 0.7 * t,
          transition: 'opacity 700ms var(--ease-out-quint)',
          background:
            'radial-gradient(circle, rgb(111 203 255 / 0.26) 0%, rgb(111 203 255 / 0.07) 34%, transparent 64%)',
        }}
      />
      {flares > 0 && (
        <div
          key={flares}
          className="orb-flare absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 44px 14px rgb(163 224 255 / 0.55)' }}
        />
      )}
      <div className="orb-breathe absolute inset-0 rounded-full">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 36% 30%, #2d333b 0%, #14181d 52%, #06080a 100%)',
            boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.07)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            opacity: 0.12 + 0.88 * t,
            transition: 'opacity 700ms var(--ease-out-quint), box-shadow 700ms var(--ease-out-quint)',
            background:
              'radial-gradient(circle at 36% 30%, #ffffff 0%, #eaf8ff 20%, #a3e0ff 46%, #3a92d4 74%, #0f3858 100%)',
            boxShadow: `0 0 ${24 + 56 * t}px ${4 + 14 * t}px rgb(111 203 255 / ${0.12 + 0.4 * t})`,
          }}
        />
      </div>
    </div>
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    // pb clears the floating tab bar plus the home indicator.
    <div className={`min-h-dvh px-5 pt-[max(1.75rem,calc(env(safe-area-inset-top)+0.75rem))] pb-36 ${className}`}>
      {children}
    </div>
  )
}

export function ScreenTitle({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: ReactNode
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <header className="rise mb-8 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="text-muted mb-2.5 text-[13px]">{eyebrow}</div>}
        <h1 className="display text-[36px]">{title}</h1>
        {sub && <p className="text-muted mt-2 text-[14.5px] leading-snug">{sub}</p>}
      </div>
      {right}
    </header>
  )
}

/** Section heading: small, sentence case, muted. */
export function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-muted text-[13px] font-medium">{children}</h2>
      {right}
    </div>
  )
}

/** Rows grouped on one faint surface, split by hairlines instead of each getting a box. */
export function List({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-surface divide-line-soft overflow-hidden rounded-[22px] border border-white/[0.05] divide-y ${className}`}
    >
      {children}
    </div>
  )
}

export function Row({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  const base = `flex w-full items-center gap-3.5 px-4 py-3.5 text-left ${className}`
  return onClick ? (
    <button onClick={onClick} className={`press-row ${base}`}>
      {children}
    </button>
  ) : (
    <div className={base}>{children}</div>
  )
}

/** An emoji set in a soft round chip, so mixed emoji styles still line up. */
export function IconChip({ icon, dim }: { icon: string; dim?: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[18px] ${
        dim ? 'opacity-45 grayscale' : ''
      }`}
    >
      {icon}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  className = '',
}: {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={`px-1 py-5 ${className}`}>
      <div className="display tnum text-[44px]">{value}</div>
      <div className="text-muted mt-2 text-[13px]">{label}</div>
      {hint && <div className="text-faint mt-0.5 text-[12px]">{hint}</div>}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'lg' | 'sm'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const styles = {
    primary: 'bg-fg text-ink active:bg-white/80 disabled:bg-white/10 disabled:text-faint',
    secondary: 'bg-white/[0.1] text-fg active:bg-white/[0.16] disabled:text-faint',
    danger: 'text-fail active:bg-fail/10',
  }[variant]
  const sizes = {
    lg: 'w-full px-6 py-3.5 text-[15px]',
    sm: 'px-4 py-2 text-[13.5px]',
  }[size]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press rounded-full font-medium disabled:active:scale-100 ${sizes} ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="bg-surface-2 flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`press flex-1 rounded-full px-3 py-2 text-[13.5px] font-medium ${
            value === o.value ? 'bg-fg text-ink' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="press text-muted -ml-1 mb-7 flex items-center gap-1 text-[14px]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  )
}

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="rise relative mx-auto max-h-[84dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border-t border-white/[0.08] bg-[#0d0d10] px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="display truncate text-[22px]">{title}</h3>
          <button
            onClick={onClose}
            className="press text-muted grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[18px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rise grid place-items-center py-14 text-center">
      <div className="mb-4 text-4xl">{icon}</div>
      <p className="display text-[20px]">{title}</p>
      <p className="text-muted mt-2 max-w-[32ch] text-[14px] leading-relaxed">{body}</p>
    </div>
  )
}

export function Flame({ count }: { count: number }) {
  const lit = count > 0
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${lit ? 'bg-ember/[0.12]' : 'bg-white/[0.06]'}`}>
      <span className={`text-[13px] ${lit ? '' : 'opacity-40 grayscale'}`}>🔥</span>
      <span className={`tnum text-[14px] font-medium ${lit ? 'text-ember' : 'text-faint'}`}>{count}</span>
    </div>
  )
}

export function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/70" />
}
