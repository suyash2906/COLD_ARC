import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Commitment } from '../lib/types'
import { IconChip } from './ui'

const moveItem = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

interface Drag {
  id: string
  pointerId: number
  lastY: number
  offset: number
}

/**
 * Drag the handle to reorder. The row follows the finger and swaps with a neighbour once
 * it passes halfway, so the list always shows where it will land.
 */
export function ReorderList({ items, onChange }: { items: Commitment[]; onChange: (ids: string[]) => void }) {
  const [order, setOrder] = useState(() => items.map((c) => c.id))
  const [drag, setDrag] = useState<Drag | null>(null)
  const rowHeight = useRef(64)
  const byId = new Map(items.map((c) => [c.id, c]))

  const down = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    rowHeight.current = e.currentTarget.closest('[data-row]')?.getBoundingClientRect().height ?? 64
    try {
      // Keep receiving moves even when the finger slides off the element.
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone; the drag still works while it stays on the element.
    }
    setDrag({ id, pointerId: e.pointerId, lastY: e.clientY, offset: 0 })
  }

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const h = rowHeight.current
    const i = order.indexOf(drag.id)
    let offset = drag.offset + (e.clientY - drag.lastY)
    let next = order
    if (offset > h / 2 && i < order.length - 1) {
      next = moveItem(order, i, i + 1)
      offset -= h
    } else if (offset < -h / 2 && i > 0) {
      next = moveItem(order, i, i - 1)
      offset += h
    }
    if (next !== order) setOrder(next)
    setDrag({ ...drag, lastY: e.clientY, offset })
  }

  const up = () => {
    if (!drag) return
    setDrag(null)
    onChange(order)
  }

  const nudge = (e: KeyboardEvent, id: string) => {
    const i = order.indexOf(id)
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1
    if (to < 0 || to >= order.length) return
    e.preventDefault()
    const next = moveItem(order, i, to)
    setOrder(next)
    onChange(next)
  }

  return (
    // Same look as List, minus the clipping, so the lifted row can float over its neighbours.
    <div className="bg-surface divide-line-soft rounded-[22px] border border-white/[0.05] divide-y">
      {order.map((id) => {
        const c = byId.get(id)
        if (!c) return null
        const dragging = drag?.id === id
        return (
          <div
            key={id}
            data-row
            className={`relative flex items-center gap-3.5 px-4 py-3 ${
              dragging ? 'z-10 rounded-[18px] bg-[#1a1a1f] shadow-[0_12px_32px_rgb(0_0_0/0.55)]' : ''
            }`}
            style={{
              transform: dragging ? `translateY(${drag.offset}px) scale(1.03)` : undefined,
              transition: dragging ? 'box-shadow 200ms' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <IconChip icon={c.icon} />
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{c.label}</span>
            <button
              onPointerDown={(e) => down(e, id)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={(e) => nudge(e, id)}
              className="text-muted -mr-2 grid h-10 w-10 touch-none place-items-center rounded-full active:bg-white/[0.06]"
              aria-label={`Move ${c.label}. Drag, or use the arrow keys.`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 9h14M5 15h14" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
