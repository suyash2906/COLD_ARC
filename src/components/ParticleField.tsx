import { useEffect, useRef, type ReactNode } from 'react'

type Tone = 'grey' | 'blue' | 'red'
const TONE_LIST: Tone[] = ['grey', 'blue', 'red']

const TONES: Record<Tone, [number, number, number]> = {
  grey: [150, 158, 172],
  blue: [120, 205, 255],
  red: [255, 92, 98],
}

interface Particle {
  /** Home position as a fraction of the canvas, so a resize only rescales it. */
  hx: number
  hy: number
  x: number
  y: number
  vx: number
  vy: number
  placed: boolean
  r: number
  alpha: number
  phase: number
  speed: number
  amp: number
  /** Dust slides sideways and wraps; arc particles stay on the arc. */
  drift: number
  /** 0..1. A particle turns blue once progress passes its rank. */
  rank: number
  target: Tone
  /** Current mix of each tone, eased toward the target so colour changes fade in. */
  mix: Record<Tone, number>
  /** Seconds to hold before fading, so a change sweeps along the arc instead of flashing. */
  wait: number
  /** Brief swell when a particle turns blue. */
  pop: number
}

// The arc wraps the orb like the particle stream around Sol: in from the left, over the
// top, and down the right-hand side. Angles are canvas angles (y points down).
const ARC_FROM = (160 * Math.PI) / 180
const ARC_SWEEP = (240 * Math.PI) / 180
const ARC_RX = 0.45
const ARC_RY = 0.38
const ARC_COUNT = 200

const SPRING = 9 // pull back toward home, per second squared
const DAMPING = 3.2 // below critical, so a scattered particle overshoots a little
const TOUCH_RADIUS = 96
const TOUCH_FORCE = 3200
const TAP_RADIUS = 150
const TAP_KICK = 420
const FADE = 3.5 // colour easing rate, per second
const SWEEP_SECONDS = 1.6 // how long a change takes to travel the whole arc

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

function particle(hx: number, hy: number, rank: number): Particle {
  return {
    hx,
    hy,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    placed: false,
    r: 1,
    alpha: 0.6,
    phase: rand(0, Math.PI * 2),
    speed: rand(0.25, 0.7),
    amp: rand(2, 7),
    drift: 0,
    rank: Math.min(0.999, Math.max(0, rank)),
    target: 'grey',
    mix: { grey: 1, blue: 0, red: 0 },
    wait: 0,
    pop: 0,
  }
}

function build(area: number): Particle[] {
  const out: Particle[] = []

  // The stream. Its rank follows its position, so progress fills the arc from left to right.
  for (let i = 0; i < ARC_COUNT; i++) {
    const t = Math.random()
    const a = ARC_FROM + t * ARC_SWEEP
    const k = 1 + rand(-0.13, 0.13) * rand(0.3, 1)
    const p = particle(0.5 + Math.cos(a) * ARC_RX * k, 0.5 + Math.sin(a) * ARC_RY * k, t + rand(-0.02, 0.02))
    p.r = rand(0.9, 2.3)
    p.alpha = rand(0.5, 0.92)
    out.push(p)
  }

  // Loose dust across the whole field, turning blue in no particular order.
  const dust = Math.max(70, Math.min(160, Math.round(area / 1100)))
  for (let i = 0; i < dust; i++) {
    const p = particle(Math.random(), Math.random(), Math.random())
    p.r = rand(0.6, 1.5)
    p.alpha = rand(0.25, 0.6)
    p.amp = rand(6, 18)
    p.speed = rand(0.12, 0.35)
    p.drift = rand(-0.006, 0.006)
    out.push(p)
  }
  return out
}

function retarget(list: Particle[], progress: number, warn: boolean, from: number, instant: boolean) {
  const cut = progress / 100
  const start = Math.min(from, cut)
  for (const p of list) {
    const next: Tone = p.rank < cut ? 'blue' : warn ? 'red' : 'grey'
    if (next === p.target) continue
    p.target = next
    if (instant) {
      for (const tone of TONE_LIST) p.mix[tone] = tone === next ? 1 : 0
      p.wait = 0
    } else {
      p.wait = Math.max(0, p.rank - start) * SWEEP_SECONDS
      if (next === 'blue') p.pop = 1
    }
  }
}

/** A soft round glow, drawn once per tone and stamped for every particle. */
function makeSprite(tone: Tone): HTMLCanvasElement {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const [r, gr, b] = TONES[tone]
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${gr},${b},1)`)
  grad.addColorStop(0.12, `rgba(${r},${gr},${b},0.92)`)
  grad.addColorStop(0.26, `rgba(${r},${gr},${b},0.3)`)
  grad.addColorStop(0.55, `rgba(${r},${gr},${b},0.06)`)
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * Floating particles that drift on their own and scatter away from a finger or cursor,
 * then settle back. They start grey and turn blue as `progress` (0–100) rises, sweeping
 * along the arc. With `warn`, the ones still grey turn red.
 *
 * Touch listeners are passive and the canvas ignores pointer events, so the page still
 * scrolls normally through it.
 */
export function ParticleField({
  progress,
  warn = false,
  className = '',
  children,
}: {
  progress: number
  warn?: boolean
  className?: string
  children?: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const shownRef = useRef({ progress: 0, warn: false })
  const drawRef = useRef<() => void>(() => {})
  const wakeRef = useRef<() => void>(() => {})

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clamped = Math.max(0, Math.min(100, progress))
    retarget(particlesRef.current, clamped, warn, shownRef.current.progress / 100, reduced)
    shownRef.current = { progress: clamped, warn }
    drawRef.current()
    wakeRef.current()
  }, [progress, warn])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = { grey: makeSprite('grey'), blue: makeSprite('blue'), red: makeSprite('red') }
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let last = 0
    let onScreen = true
    const pointer = { x: 0, y: 0, active: false }

    const place = (p: Particle) => {
      p.x = p.hx * w
      p.y = p.hy * h
      p.placed = true
    }

    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      const t = time / 1000
      for (const p of particlesRef.current) {
        if (!p.placed) place(p)
        const a = p.alpha * (0.82 + 0.18 * Math.sin(t * p.speed * 3 + p.phase))
        const s = p.r * 9 * (1 + 0.8 * p.pop)
        for (const tone of TONE_LIST) {
          const m = p.mix[tone]
          if (m < 0.02) continue
          ctx.globalAlpha = Math.min(1, a * m)
          ctx.drawImage(sprites[tone], p.x - s / 2, p.y - s / 2, s, s)
        }
      }
      ctx.globalAlpha = 1
    }

    const step = (dt: number, time: number) => {
      const t = time / 1000
      const damp = Math.exp(-DAMPING * dt)
      const ease = 1 - Math.exp(-FADE * dt)
      const settle = Math.exp(-3 * dt)
      for (const p of particlesRef.current) {
        if (!p.placed) place(p)

        if (p.wait > 0) {
          p.wait -= dt
        } else {
          for (const tone of TONE_LIST) p.mix[tone] += ((tone === p.target ? 1 : 0) - p.mix[tone]) * ease
          p.pop *= settle
        }

        if (p.drift) {
          p.hx += p.drift * dt
          if (p.hx > 1.05) {
            p.hx = -0.05
            p.x = p.hx * w
          } else if (p.hx < -0.05) {
            p.hx = 1.05
            p.x = p.hx * w
          }
        }
        const tx = p.hx * w + Math.sin(t * p.speed + p.phase) * p.amp
        const ty = p.hy * h + Math.cos(t * p.speed * 0.8 + p.phase * 1.3) * p.amp
        p.vx += (tx - p.x) * SPRING * dt
        p.vy += (ty - p.y) * SPRING * dt

        if (pointer.active) {
          const dx = p.x - pointer.x
          const dy = p.y - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < TOUCH_RADIUS * TOUCH_RADIUS && d2 > 0.01) {
            const d = Math.sqrt(d2)
            const f = (1 - d / TOUCH_RADIUS) ** 2 * TOUCH_FORCE * dt
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
        }

        p.vx *= damp
        p.vy *= damp
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
    }

    const running = () => !reduced && onScreen && document.visibilityState === 'visible'

    const tick = (time: number) => {
      raf = 0
      // A long gap means we were paused; do not let particles leap to catch up.
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016
      last = time
      step(dt, time)
      draw(time)
      schedule()
    }

    const schedule = () => {
      if (!raf && running()) raf = requestAnimationFrame(tick)
    }

    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      last = 0
    }

    drawRef.current = () => {
      if (!raf) draw(performance.now())
    }
    wakeRef.current = schedule

    const resize = () => {
      const box = wrap.getBoundingClientRect()
      w = box.width
      h = box.height
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      if (particlesRef.current.length === 0) {
        particlesRef.current = build(w * h)
        // Start grey and let the day's progress sweep in, unless motion is reduced.
        const { progress: shown, warn: warned } = shownRef.current
        retarget(particlesRef.current, shown, warned, 0, reduced)
        for (const p of particlesRef.current) p.pop = 0
      }
      if (reduced) for (const p of particlesRef.current) place(p)
      draw(performance.now())
    }

    const burst = (x: number, y: number) => {
      if (reduced) return
      for (const p of particlesRef.current) {
        const dx = p.x - x
        const dy = p.y - y
        const d = Math.hypot(dx, dy)
        if (d > 0.1 && d < TAP_RADIUS) {
          const k = (1 - d / TAP_RADIUS) * TAP_KICK
          p.vx += (dx / d) * k
          p.vy += (dy / d) * k
        }
      }
      schedule()
    }

    const at = (clientX: number, clientY: number) => {
      const box = wrap.getBoundingClientRect()
      pointer.x = clientX - box.left
      pointer.y = clientY - box.top
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      at(e.clientX, e.clientY)
      pointer.active = true
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      at(e.clientX, e.clientY)
      burst(pointer.x, pointer.y)
    }
    const onPointerLeave = () => {
      pointer.active = false
    }
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      at(touch.clientX, touch.clientY)
      pointer.active = true
      burst(pointer.x, pointer.y)
    }
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) at(touch.clientX, touch.clientY)
    }
    const onTouchEnd = () => {
      pointer.active = false
    }
    const onVisibility = () => (running() ? schedule() : stop())

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(wrap)
    const viewObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (running()) schedule()
      else stop()
    })
    viewObserver.observe(wrap)

    wrap.addEventListener('pointermove', onPointerMove, { passive: true })
    wrap.addEventListener('pointerdown', onPointerDown, { passive: true })
    wrap.addEventListener('pointerleave', onPointerLeave, { passive: true })
    wrap.addEventListener('touchstart', onTouchStart, { passive: true })
    wrap.addEventListener('touchmove', onTouchMove, { passive: true })
    wrap.addEventListener('touchend', onTouchEnd, { passive: true })
    wrap.addEventListener('touchcancel', onTouchEnd, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    resize()
    schedule()

    return () => {
      stop()
      drawRef.current = () => {}
      wakeRef.current = () => {}
      sizeObserver.disconnect()
      viewObserver.disconnect()
      wrap.removeEventListener('pointermove', onPointerMove)
      wrap.removeEventListener('pointerdown', onPointerDown)
      wrap.removeEventListener('pointerleave', onPointerLeave)
      wrap.removeEventListener('touchstart', onTouchStart)
      wrap.removeEventListener('touchmove', onTouchMove)
      wrap.removeEventListener('touchend', onTouchEnd)
      wrap.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]"
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
