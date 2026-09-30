import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Today', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.4 12.2l2.6 2.6 4.6-5.2' },
  { to: '/grid', label: 'Grid', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { to: '/stats', label: 'Stats', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/settings', label: 'More', icon: 'M4 6h16M4 12h16M4 18h16' },
]

const LAST = TABS.length - 1
// Overshoot on the way in, so the bubble lands with a little bounce.
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const JELLY = 'cubic-bezier(0.34, 1.9, 0.64, 1)'

interface Drag {
  pointerId: number
  startX: number
  from: number
  pos: number
  moved: boolean
}

/**
 * Liquid glass: the bar is nearly clear, so what scrolls underneath shows through as a
 * blur. The selection is a bubble you can drag between tabs; it squishes while moving
 * and springs into place when you let go.
 */
export function TabBar() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const active = TABS.findIndex((t) => t.to === pathname)
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wobble, setWobble] = useState(false)

  const go = (i: number) => {
    if (i === active) return
    setWobble(true)
    window.setTimeout(() => setWobble(false), 240)
    nav(TABS[i].to)
  }

  const tabWidth = () => (trackRef.current?.getBoundingClientRect().width ?? 1) / TABS.length

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = active < 0 ? Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / tabWidth()) : active
    try {
      // Keep receiving moves even when the finger slides off the element.
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone; the drag still works while it stays on the element.
    }
    setDrag({ pointerId: e.pointerId, startX: e.clientX, from: start, pos: start, moved: false })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.startX
    if (!drag.moved && Math.abs(dx) < 6) return
    const pos = Math.max(-0.15, Math.min(LAST + 0.15, drag.from + dx / tabWidth()))
    setDrag({ ...drag, pos, moved: true })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const box = e.currentTarget.getBoundingClientRect()
    // A drag lands on the nearest tab; a plain tap lands on the tab under the finger.
    const target = drag.moved
      ? Math.round(Math.max(0, Math.min(LAST, drag.pos)))
      : Math.max(0, Math.min(LAST, Math.floor((e.clientX - box.left) / tabWidth())))
    setDrag(null)
    if (target !== active) go(target)
  }

  const shown = drag?.moved ? drag.pos : active
  const squish = drag?.moved ? 'scale(1.14, 0.9)' : wobble ? 'scale(1.1, 0.92)' : 'scale(1, 1)'

  return (
    <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        className="liquid-bar relative flex w-full max-w-[26rem] touch-none rounded-full p-1.5 select-none"
      >
        <div className="pointer-events-none absolute inset-1.5">
          <div
            className="h-full"
            style={{
              width: `${100 / TABS.length}%`,
              opacity: shown < 0 ? 0 : 1,
              transform: `translateX(${Math.max(0, shown) * 100}%)`,
              transition: drag?.moved ? 'opacity 200ms' : `transform 560ms ${SPRING}, opacity 200ms`,
            }}
          >
            <div
              className="liquid-bubble h-full rounded-full"
              style={{ transform: squish, transition: `transform 420ms ${JELLY}` }}
            />
          </div>
        </div>

        {TABS.map((t, i) => {
          const on = i === (drag?.moved ? Math.round(drag.pos) : active)
          return (
            <button
              key={t.to}
              // Pointer taps are handled on the bar so a drag can end anywhere; this keeps keyboards working.
              onClick={(e) => e.detail === 0 && go(i)}
              aria-current={i === active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 transition-colors duration-200 ${
                on ? 'text-fg' : 'text-white/60'
              }`}
            >
              <svg
                key={on ? 'on' : 'off'}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={on ? 2.1 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={on ? 'tab-pop' : ''}
                aria-hidden
              >
                <path d={t.icon} />
              </svg>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
