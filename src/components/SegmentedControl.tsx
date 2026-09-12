/**
 * 2–4 tabs with a sliding accent-soft pill. Keyboard: arrows move, Home/End.
 * Implements the ARIA tabs pattern (role=tablist / tab).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import styles from './SegmentedControl.module.css'

export interface Segment<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  segments: ReadonlyArray<Segment<T>>
  value: T
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
  block?: boolean
  /** No track, spread across the full width, only the selection in a pill — for a range
      selector, where a filled bar competes with the chart it belongs to. */
  bare?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({ segments, value, onChange, label, size = 'md', block = false, bare = false, className }: SegmentedControlProps<T>) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)

  const measure = () => {
    const root = ref.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[aria-selected="true"]')
    if (active) setPill({ x: active.offsetLeft, w: active.offsetWidth })
  }
  useLayoutEffect(measure, [value, segments.length, size])
  useEffect(() => {
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ref.current && ro) ro.observe(ref.current)
    return () => ro?.disconnect()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = segments.findIndex((s) => s.value === value)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % segments.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + segments.length) % segments.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = segments.length - 1
    else return
    e.preventDefault()
    const seg = segments[next]
    if (seg) {
      onChange(seg.value)
      ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
    }
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} className={cn(styles.control, styles[size], (block || bare) && styles.block, bare && styles.bare, className)} onKeyDown={onKeyDown}>
      {pill ? <span className={styles.pill} style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} aria-hidden="true" /> : null}
      {segments.map((s) => {
        const selected = s.value === value
        return (
          <button
            key={s.value}
            id={`${id}-${s.value}`}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(styles.segment, selected && styles.selected)}
            onClick={() => onChange(s.value)}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
