import { useEffect, useRef, type ReactNode } from 'react'

/** One day of the arc, as the field needs to draw it. */
export interface FieldDay {
  score: number
  touched: boolean
  future: boolean
  today: boolean
}

type Tone = 'white' | 'ice' | 'ember' | 'dim'

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
  tone: Tone
  pulse: boolean
  phase: number
  speed: number
  amp: number
  /** Dust slides sideways and wraps; arc particles stay on the arc. */
  drift: number
}

const TONES: Record<Tone, [number, number, number]> = {
  white: [255, 255, 255],
  ice: [163, 224, 255],
  ember: [255, 154, 82],
  dim: [170, 186, 204],
}

// The arc wraps the orb like the particle stream around Sol: in from the left, over the
// top, and down the right-hand side. Angles are canvas angles (y points down).
const ARC_FROM = (160 * Math.PI) / 180
const ARC_SWEEP = (240 * Math.PI) / 180
const ARC_RX = 0.45
const ARC_RY = 0.4

const SPRING = 9 // pull back toward home, per second squared
const DAMPING = 3.2 // below critical, so a scattered particle overshoots a little
const TOUCH_RADIUS = 96
const TOUCH_FORCE = 3200
const TAP_RADIUS = 150
const TAP_KICK = 420

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

function arcPoint(t: number, spread: number): [number, number] {
  const a = ARC_FROM + t * ARC_SWEEP
  const k = 1 + spread
  return [0.5 + Math.cos(a) * ARC_RX * k, 0.5 + Math.sin(a) * ARC_RY * k]
}

function baseParticle(hx: number, hy: number): Particle {
  return {
    hx,
    hy,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    placed: false,
    r: 1,
    alpha: 0.5,
    tone: 'ice',
    pulse: false,
    phase: rand(0, Math.PI * 2),
    speed: rand(0.25, 0.7),
    amp: rand(2, 7),
    drift: 0,
  }
}

/** How a single day of the arc looks: bright when it went well, faint when it has not happened. */
function styleDay(p: Particle, d: FieldDay) {
  p.pulse = d.today
  if (d.today) {
    p.r = 2
    p.alpha = 1
    p.tone = d.score >= 100 ? 'white' : 'ice'
  } else if (d.future) {
    p.r = 0.85
    p.alpha = 0.32
    p.tone = 'dim'
  } else if (!d.touched || d.score === 0) {
    p.r = 0.8
    p.alpha = 0.24
    p.tone = 'dim'
  } else if (d.score >= 100) {
    p.r = 1.8
    p.alpha = 0.95
    p.tone = 'white'
  } else if (d.score >= 60) {
    p.r = 1.35
    p.alpha = 0.75
    p.tone = 'ice'
  } else {
    p.r = 1
    p.alpha = 0.3 + d.score / 200
    p.tone = 'ice'
  }
}

function buildArc(days: FieldDay[] | undefined): Particle[] {
  const out: Particle[] = []
  const count = days?.length ?? 110

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const [hx, hy] = arcPoint(t, rand(-0.09, 0.09))
    const p = baseParticle(hx, hy)
    if (days) {
      styleDay(p, days[i])
    } else {
      // Decorative arc for onboarding: brightest over the top, like light catching it.
      const lift = Math.sin(t * Math.PI)
      p.r = rand(0.6, 1.2) + lift * rand(0, 1.1)
      p.alpha = rand(0.25, 0.55) + lift * 0.4
      p.tone = Math.random() < 0.08 ? 'ember' : Math.random() < 0.45 ? 'white' : 'ice'
    }
    out.push(p)
  }

  // A thinner haze along the same path, so the arc reads as a stream and not a dotted line.
  for (let i = 0; i < Math.round(count * 0.6); i++) {
    const [hx, hy] = arcPoint(Math.random(), rand(-0.16, 0.16))
    const p = baseParticle(hx, hy)
    p.r = rand(0.35, 0.8)
    p.alpha = rand(0.1, 0.35)
    p.tone = Math.random() < 0.1 ? 'ember' : Math.random() < 0.5 ? 'white' : 'ice'
    out.push(p)
  }
  return out
}

function buildDust(area: number): Particle[] {
  const count = Math.max(50, Math.min(130, Math.round(area / 1500)))
  return Array.from({ length: count }, () => {
    const p = baseParticle(Math.random(), Math.random())
    p.r = rand(0.35, 1.05)
    p.alpha = rand(0.07, 0.32)
    p.tone = Math.random() < 0.07 ? 'ember' : Math.random() < 0.5 ? 'dim' : 'white'
    p.amp = rand(6, 18)
    p.speed = rand(0.12, 0.35)
    p.drift = rand(-0.006, 0.006)
    return p
  })
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
  grad.addColorStop(0.1, `rgba(${r},${gr},${b},0.9)`)
  grad.addColorStop(0.22, `rgba(${r},${gr},${b},0.28)`)
  grad.addColorStop(0.5, `rgba(${r},${gr},${b},0.06)`)
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * Floating particles that drift on their own and scatter away from a finger or cursor,
 * then settle back. With `days`, one particle per arc day forms the arc — lit by how that
 * day went — so the decoration is also a read-out.
 *
 * Touch listeners are passive and the canvas ignores pointer events, so the page still
 * scrolls normally through it.
 */
export function ParticleField({
  days,
  className = '',
  children,
}: {
  days?: FieldDay[]
  className?: string
  children?: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const arcRef = useRef<Particle[]>([])
  const dustRef = useRef<Particle[]>([])
  const dayCountRef = useRef(-1)
  const drawRef = useRef<() => void>(() => {})

  // Restyle in place when scores change so nothing jumps; rebuild only if the arc changed length.
  useEffect(() => {
    const count = days?.length ?? 0
    if (arcRef.current.length > 0 && count === dayCountRef.current) {
      days?.forEach((d, i) => styleDay(arcRef.current[i], d))
    } else {
      arcRef.current = buildArc(days)
      dayCountRef.current = count
    }
    drawRef.current()
  }, [days])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = {
      white: makeSprite('white'),
      ice: makeSprite('ice'),
      ember: makeSprite('ember'),
      dim: makeSprite('dim'),
    }
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
      for (const list of [dustRef.current, arcRef.current]) {
        for (const p of list) {
          if (!p.placed) place(p)
          let a = p.alpha * (0.82 + 0.18 * Math.sin(t * p.speed * 3 + p.phase))
          if (p.pulse) a *= 0.55 + 0.45 * Math.sin(t * 2.6)
          const s = p.r * 9
          ctx.globalAlpha = Math.max(0, Math.min(1, a))
          ctx.drawImage(sprites[p.tone], p.x - s / 2, p.y - s / 2, s, s)
        }
      }
      ctx.globalAlpha = 1
    }

    const step = (dt: number, time: number) => {
      const t = time / 1000
      const damp = Math.exp(-DAMPING * dt)
      for (const list of [dustRef.current, arcRef.current]) {
        for (const p of list) {
          if (!p.placed) place(p)
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

    const resize = () => {
      const box = wrap.getBoundingClientRect()
      w = box.width
      h = box.height
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      if (dustRef.current.length === 0) dustRef.current = buildDust(w * h)
      if (reduced) for (const p of [...dustRef.current, ...arcRef.current]) place(p)
      draw(performance.now())
    }

    const burst = (x: number, y: number) => {
      if (reduced) return
      for (const p of [...dustRef.current, ...arcRef.current]) {
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
        className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)]"
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
