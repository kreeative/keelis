/**
 * Bottom sheet: 36×4 handle, 20px top corners, backdrop --ink-900/0.35,
 * the only element allowed a shadow. Focus is trapped; Escape closes.
 * On desktop (≥768px) it becomes a centred dialog with the same styling.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import styles from './Sheet.module.css'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Sticky footer (buttons) */
  footer?: ReactNode
  /** Prevent closing by backdrop/Escape (e.g. while submitting) */
  locked?: boolean
  className?: string
  /** aria-label if no visible title */
  label?: string
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Sheet({ open, onClose, title, children, footer, locked = false, className, label }: SheetProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus first focusable element (or panel) on open.
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel.current)?.focus()
    }, 10)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]!
        const last = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreFocus.current?.focus?.()
    }
  }, [open, locked, onClose])

  if (!open) return null
  return createPortal(
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={() => !locked && onClose()} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        aria-label={!title ? label : undefined}
        className={cn(styles.panel, className)}
        tabIndex={-1}
      >
        <div className={styles.handle} aria-hidden="true" />
        {title ? (
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
        ) : null}
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
