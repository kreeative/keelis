/**
 * A money flow, one step per screen.
 *
 * The owner's rule, given twice: **the calculator never shares a screen with anything
 * else.** Enter the amount, look at the aperçu, confirm. `Ajouter des fonds` was built
 * that way and the other five flows were not — `/envoyer` put a method picker, a name, an
 * operator row, a phone number, a message, a keypad and a « Continuer » on one page, so
 * the amount you were typing sat under the fold while you typed it and the recap beside it
 * was a total that was still changing.
 *
 * This is that shape, written once. A flow declares its steps; this decides which screen
 * is showing, what the back arrow does, and where « Continuer » goes.
 *
 * **From 1024px the steps become one form** (`useLargeScreen`, the kit's « optimize for
 * devices »): a keyboard and a mouse beat a wizard, so the whole task is on screen at once
 * and the step counter disappears — but the mobile flow is untouched, because that is the
 * one people know from the app.
 */
import { useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, PageHeader } from '@/components'
import { useLargeScreen } from '@/store'
import styles from './StepFlow.module.css'

export interface FlowStep {
  /** Stable id — the flow's own name for this step, used as the heading's id. */
  id: string
  /** The step's heading. Also the section header when the steps are grouped. */
  title: string
  content: ReactNode
  /**
   * Runs when the person tries to leave this step. Return false to keep them on it — the
   * step is responsible for having said why, in its own fields.
   */
  validate?: () => boolean
  /** « Continuer » unless the step says otherwise. */
  nextLabel?: string
  /** Blocks the primary action outright, for a step that cannot be satisfied yet. */
  nextDisabled?: boolean
  /** Left out of the flow entirely — an internal transfer has no recipient to fill in. */
  skip?: boolean
  /** Rendered under the primary action (an « Ajouter des fonds » escape hatch, a note). */
  footer?: ReactNode
}

export interface StepFlowProps {
  title: string
  /** Where the ✕ goes: out of the flow, from the first step. */
  exit: string
  steps: FlowStep[]
  /** The last step's action. This is where the confirmation opens. */
  onFinish: () => void
  /** Label of that last action — « Envoyer », « Convertir », « Acheter ». */
  finishLabel: string
  finishDisabled?: boolean
  /** Query parameter holding the step. Only matters if a flow needs two on one route. */
  param?: string
  className?: string
}

export function StepFlow({ title, exit, steps, onFinish, finishLabel, finishDisabled, param = 'etape', className }: StepFlowProps) {
  const grouped = useLargeScreen()
  const visible = steps.filter((s) => !s.skip)
  const [params, setParams] = useSearchParams()

  /**
   * The step lives in the URL, not in a `useState`.
   *
   * Because a step can *leave the route and come back*: the recipient screen sends you to
   * `/envoyer/operateurs` to pick a rail, and returning re-mounts this component. With the
   * step in component state that round trip dumped you back on step one — measured, not
   * guessed — having chosen an operator for a form you now had to walk to again.
   *
   * Written with `replace`, so the phone's back gesture leaves the flow rather than
   * reversing through it one screen at a time. The header's arrow is what walks back a
   * step, and it is on every screen but the first.
   */
  const raw = Number(params.get(param) ?? '1')
  const index = Number.isFinite(raw) ? Math.round(raw) - 1 : 0
  const at = Math.min(Math.max(0, index), Math.max(0, visible.length - 1))

  const goTo = (next: number) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set(param, String(next + 1))
        return p
      },
      { replace: true },
    )

  /* A step can disappear under you — choosing « Interne » on /envoyer drops the recipient
     screen — and a URL pointing past the end renders nothing at all. */
  useEffect(() => {
    if (at !== index) goTo(at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, index])

  const step = visible[at]
  if (!step) return null
  const last = at === visible.length - 1

  function advance() {
    if (!step) return
    if (step.validate && !step.validate()) return
    if (last) onFinish()
    else goTo(at + 1)
  }

  /* Grouped: every step at once, each under its own section heading, one action at the
     end that runs every step's validation in order — so the first thing that fails is the
     first thing that failed, not the last. */
  if (grouped) {
    return (
      <div className={className}>
        <PageHeader close back={exit} title={title} />
        {visible.map((s) => (
          <section key={s.id} className={styles.section} aria-labelledby={`${s.id}-title`}>
            <h2 id={`${s.id}-title`} className="t-section">
              {s.title}
            </h2>
            {s.content}
          </section>
        ))}
        <div className={styles.footer}>
          <Button
            size="lg"
            block
            disabled={finishDisabled}
            onClick={() => {
              for (const s of visible) if (s.validate && !s.validate()) return
              onFinish()
            }}
          >
            {finishLabel}
          </Button>
          {visible.map((s) => (s.footer ? <div key={s.id}>{s.footer}</div> : null))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <PageHeader
        close={at === 0}
        /* From step two on, the arrow goes back a *step*. Leaving the route instead would
           throw away everything typed on the way here, which is the one thing a wizard
           must not do. */
        back={at === 0 ? exit : () => goTo(at - 1)}
        title={title}
        eyebrow={visible.length > 1 ? `Étape ${at + 1} sur ${visible.length}` : undefined}
      />
      <section className={styles.section} aria-labelledby={`${step.id}-title`}>
        <h2 id={`${step.id}-title`} className="t-section">
          {step.title}
        </h2>
        {step.content}
      </section>
      <div className={styles.footer}>
        <Button size="lg" block disabled={last ? finishDisabled : step.nextDisabled} onClick={advance}>
          {last ? finishLabel : (step.nextLabel ?? 'Continuer')}
        </Button>
        {step.footer}
      </div>
    </div>
  )
}
