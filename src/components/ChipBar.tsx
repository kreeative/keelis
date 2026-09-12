/**
 * A row of filter chips that scrolls sideways. Unlike SegmentedControl, which divides a
 * fixed width between its segments, this one is content-sized and keeps going past the
 * edge — so a list can offer more ways to cut itself than fit on a phone.
 *
 * Same ARIA tabs pattern as SegmentedControl: one tab stop, arrows move and select, and
 * the selection is scrolled back into view when it is reached from the keyboard.
 */
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import styles from './ChipBar.module.css'

export interface Chip<T extends string> {
  value: T
  label: string
  /** Shown after the label, e.g. a count */
  meta?: string
}

export interface ChipBarProps<T extends string> {
  chips: ReadonlyArray<Chip<T>>
  value: T
  onChange: (value: T) => void
  /** Names the group for screen readers */
  label: string
  className?: string
}

export function ChipBar<T extends string>({ chips, value, onChange, label, className }: ChipBarProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const idx = chips.findIndex((c) => c.value === value)

  // keep the active chip visible when the list is wider than the screen
  useEffect(() => {
    const el = ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[idx]
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [idx])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % chips.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + chips.length) % chips.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = chips.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(chips[next]!.value)
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus())
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} className={cn(styles.bar, className)} onKeyDown={onKeyDown}>
      {chips.map((c) => {
        const on = c.value === value
        return (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cn(styles.chip, on && styles.on)}
            onClick={() => onChange(c.value)}
          >
            {c.label}
            {c.meta ? <span className={styles.meta}>{c.meta}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
