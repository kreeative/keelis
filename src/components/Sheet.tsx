/**
 * Bottom sheet: 36×4 handle, 20px top corners, backdrop --ink-900/0.35,
 * the only element allowed a shadow. Focus is trapped; Escape closes.
 * On desktop (≥768px) it becomes a centred dialog with the same styling.
 *
 * **On a phone it follows the finger.** A sheet that can only be dismissed by a button or
 * a tap on the backdrop is a modal wearing a sheet's shape; on iOS, and in every Framer
 * prototype the owner pointed at, the surface is *held*: pulled down it comes with the
 * finger, let go past a third of its height — or flicked — it leaves from where it was,
 * let go short of that it springs back. `usePullToDismiss` is that, on pointer events so
 * a mouse can do it too. The drag starts from the handle and the title always, and from
 * the body only when the body is scrolled to its top and the finger moves down — a list
 * that is being scrolled must never be mistaken for a sheet being pulled. Above the top the
 * sheet rubber-bands, at a quarter of the distance, because a surface that stops dead
 * against an invisible wall reads as broken.
 */
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
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

/** The drag has to travel this far before it is a drag rather than a tap. */
const DRAG_SLOP = 6
/** Let go past this fraction of the sheet's height and it leaves. */
const DISMISS_FRACTION = 0.34
/** Or flick it: px per ms, measured over the last few moves. */
const DISMISS_VELOCITY = 0.55

interface Drag {
  pointerId: number
  startY: number
  /** Whether the pointer landed in the scrollable body rather than on the handle or title. */
  inBody: boolean
  /** Undecided until the slop is crossed; then a drag, or handed to the scroller. */
  dragging: boolean
  abandoned: boolean
  lastY: number
  lastT: number
  velocity: number
}

/**
 * The gesture. Returns the handlers for the panel and the body's ref, and drives the panel
 * with inline styles — a transform while the finger holds it, a transition when it snaps
 * back — and writes `--sheet-y` and `--sheet-veil` on the root element, where the exit
 * keyframes read them, so a sheet let go at 200px leaves from 200px rather than jumping to
 * the top first, and the veil fades from where the pull had thinned it to. On the root, not
 * on the panel: the panel is re-rendered on close, and a property left on the old node is
 * a property the exit never sees.
 */
function usePullToDismiss(panel: React.RefObject<HTMLDivElement | null>, body: React.RefObject<HTMLDivElement | null>, enabled: boolean, onClose: () => void) {
  const drag = useRef<Drag | null>(null)
  const backdrop = useRef<HTMLDivElement>(null)

  const paint = (y: number) => {
    const el = panel.current
    if (!el) return
    const h = el.offsetHeight || 1
    el.style.transition = 'none'
    el.style.transform = `translateY(${y}px)`
    const veil = Math.max(0, 1 - y / h)
    document.documentElement.style.setProperty('--sheet-y', `${y}px`)
    document.documentElement.style.setProperty('--sheet-veil', String(veil))
    if (backdrop.current) {
      backdrop.current.style.transition = 'none'
      backdrop.current.style.opacity = String(veil)
    }
  }

  const settle = () => {
    const el = panel.current
    if (!el) return
    /* Back to rest on the control spring, then the inline styles go so the stylesheet owns
       the sheet again — a lingering inline transform would fight the exit animation. */
    el.style.transition = 'transform var(--dur-snappy) var(--ease-snappy)'
    el.style.transform = ''
    if (backdrop.current) {
      backdrop.current.style.transition = 'opacity var(--dur-snappy) var(--ease-snappy)'
      backdrop.current.style.opacity = ''
    }
    const done = () => {
      el.style.transition = ''
      document.documentElement.style.removeProperty('--sheet-y')
      document.documentElement.style.removeProperty('--sheet-veil')
      if (backdrop.current) backdrop.current.style.transition = ''
      el.removeEventListener('transitionend', done)
    }
    el.addEventListener('transitionend', done)
    window.setTimeout(done, 400)
  }

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || e.button !== 0) return
      const target = e.target as HTMLElement
      /* Not from a control: a press on a button is a press on a button. */
      if (target.closest('button,a,input,select,textarea,[role="slider"]')) return
      drag.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        inBody: !!body.current && body.current.contains(target),
        dragging: false,
        abandoned: false,
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
      }
    },
    [enabled, body],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId || d.abandoned) return
      const dy = e.clientY - d.startY
      if (!d.dragging) {
        if (Math.abs(dy) < DRAG_SLOP) return
        /* From the body, only a downward pull with nothing left to scroll is ours; anything
           else belongs to the list and the gesture is handed over for good. */
        if (dy < 0 || (d.inBody && (body.current?.scrollTop ?? 0) > 0)) {
          d.abandoned = true
          return
        }
        d.dragging = true
        panel.current?.setPointerCapture(e.pointerId)
        panel.current?.setAttribute('data-dragging', '')
      }
      const dt = Math.max(1, e.timeStamp - d.lastT)
      d.velocity = (e.clientY - d.lastY) / dt
      d.lastY = e.clientY
      d.lastT = e.timeStamp
      /* Upward past the rest position, the sheet resists: a quarter of the distance. */
      paint(dy >= 0 ? dy : dy / 4)
    },
    [body, panel],
  )

  const onPointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      drag.current = null
      if (!d.dragging) return
      panel.current?.removeAttribute('data-dragging')
      try {
        panel.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      const dy = e.clientY - d.startY
      const h = panel.current?.offsetHeight ?? 1
      const leaves = e.type !== 'pointercancel' && (dy > h * DISMISS_FRACTION || (dy > DRAG_SLOP && d.velocity > DISMISS_VELOCITY))
      if (leaves) {
        /* The exit keyframes read --sheet-y and --sheet-veil off the root, which still say
           where the finger let go; the inline styles must not stay, or they would hold the
           sheet there through the exit. The root's two are cleared when the exit is over. */
        if (panel.current) {
          panel.current.style.transition = ''
          panel.current.style.transform = ''
        }
        if (backdrop.current) {
          backdrop.current.style.transition = ''
          backdrop.current.style.opacity = ''
        }
        onClose()
      } else settle()
    },
    [onClose, panel],
  )

  return { backdrop, handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd } }
}

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
      root.style.removeProperty('--sheet-y')
      root.style.removeProperty('--sheet-veil')
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
  const body = useRef<HTMLDivElement>(null)
  /* The pull exists on the bottom sheet only: a centred dialog has no edge to pull from. */
  const [pullable, setPullable] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setPullable(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  const pull = usePullToDismiss(panel, body, pullable && open && !locked, onClose)

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
      <div ref={pull.backdrop} className={styles.backdrop} onClick={() => open && !locked && onClose()} aria-hidden="true" />
      <div
        ref={panel}
        {...pull.handlers}
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
        <div ref={body} className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
