/**
 * Bottom sheet: 36×4 handle, 20px top corners, backdrop --ink-900/0.35,
 * the only element allowed a shadow. Focus is trapped; Escape closes.
 * On desktop (≥768px) it becomes a centred dialog with the same styling.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { EXIT_MS, reducedMotion } from '@/lib/motion'
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

/* How many sheets are on screen. Nested sheets exist (a confirmation over a filter), and
   the page behind must not spring back the moment the inner one closes. */
let presenting = 0
/** Where the page was scrolled to when the first sheet went up. */
let frozenAt = 0

/**
 * Push the page behind back, the way iOS does when a card comes up over it. It is not
 * decoration: it is what says the thing underneath is still there and still yours, rather
 * than having been replaced.
 *
 * The styling is in base.css on `.app-view`, and so is why the view has to be *frozen*
 * before it can be scaled. All this does is count, and carry the scroll position across
 * the freeze: while `data-sheet` is set the page is a fixed, one-screen-tall box that
 * cannot scroll, so the browser clamps the document scroll to zero and it has to be put
 * back by hand when the sheet finally goes.
 */
function setPresenting(delta: number) {
  const root = document.documentElement
  const before = presenting
  presenting = Math.max(0, presenting + delta)
  if (presenting > 0 && before === 0) {
    frozenAt = window.scrollY
    root.style.setProperty('--view-scroll', `${-frozenAt}px`)
  }
  if (presenting > 0) root.dataset.sheet = 'open'
  else if (before > 0) {
    /* The exit runs against a page that is still frozen: letting go here instead would
       restore the document's height under a page that is still scaled, and the fixed nav
       would spend the whole exit at the bottom of the document rather than the screen. */
    root.dataset.sheet = 'closing'
    window.setTimeout(() => {
      if (presenting > 0) return
      delete root.dataset.sheet
      root.style.removeProperty('--view-scroll')
      window.scrollTo(0, frozenAt)
    }, EXIT_MS)
  }
}

export function Sheet({ open, onClose, title, children, footer, locked = false, className, label }: SheetProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  /* Mounted *through* the exit. React unmounts on `open === false` immediately, which is
     why the sheet had no way out: a surface that takes 690 ms to arrive was disappearing
     between two frames. `closing` keeps it in the tree for exactly the length of the exit
     animation and nothing longer. */
  const [closing, setClosing] = useState(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setClosing(false)
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    if (reducedMotion()) return
    setClosing(true)
    const t = setTimeout(() => setClosing(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  const mounted = open || closing
  /* Tied to `open`, so the page comes forward at the same moment the sheet starts leaving
     rather than after it — both take `--dur-exit` and they run together, which is what it
     looks like on iOS. Sequencing them would make dismissing a sheet take twice as long as
     opening one felt like it should. */
  useEffect(() => {
    if (!open) return
    setPresenting(1)
    return () => setPresenting(-1)
  }, [open])

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
      /* Focus goes back to the opener now, not when the exit animation ends: a keyboard
         user should not have to wait out a slide to carry on, and the closing panel is
         `inert` below so it is not a place focus could land in the meantime. */
      restoreFocus.current?.focus?.()
    }
  }, [open, locked, onClose])

  if (!mounted) return null
  return createPortal(
    <div className={cn(styles.root, !open && styles.closing)} inert={!open}>
      <div className={styles.backdrop} onClick={() => open && !locked && onClose()} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        aria-label={!title ? label : undefined}
        aria-hidden={!open ? true : undefined}
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
