/**
 * The kit's list selector: a choice among options, drawn as universal rows with a radio
 * trailing rather than as a native <select>. Each option carries the rich content the kit
 * shows — a leading mark, a title, a secondary line, and an optional value on the right —
 * and the list takes a footer slot for its escape hatch (« Ajouter une source », « Vous ne
 * trouvez pas ? »).
 *
 * It is a real radiogroup: one tab stop, arrows move and select, Home/End jump to the ends.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { List, ListRow } from './ListRow'
import { Radio } from './Radio'
import styles from './ChoiceList.module.css'

export interface ChoiceOption {
  value: string
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  /** Right content — the kit's rich option */
  detail?: ReactNode
  detailSub?: ReactNode
  disabled?: boolean
  /** Spoken name, when the title is not a plain string */
  label?: string
}

export interface ChoiceListProps {
  options: ChoiceOption[]
  value: string | null
  onChange: (value: string) => void
  /** Names the group for screen readers */
  label: string
  footer?: ReactNode
  className?: string
}

export function ChoiceList({ options, value, onChange, label, footer, className }: ChoiceListProps) {
  const ref = useRef<HTMLDivElement>(null)

  const enabled = options.filter((o) => !o.disabled)
  const selected = options.findIndex((o) => o.value === value && !o.disabled)
  /** The single tab stop: the selection, or the first option that can take one. */
  const tabIndexOf = (i: number) => (selected >= 0 ? (i === selected ? 0 : -1) : options[i] === enabled[0] ? 0 : -1)

  function focusValue(next: string) {
    onChange(next)
    // the row is re-rendered with the new tab stop; move focus to it
    requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(next)}"]`)?.focus()
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (enabled.length === 0) return
    const here = enabled.findIndex((o) => o.value === value)
    const step = (d: number) => enabled[(((here < 0 ? 0 : here) + d) % enabled.length + enabled.length) % enabled.length]
    let next: ChoiceOption | undefined
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = here < 0 ? enabled[0] : step(1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = here < 0 ? enabled[enabled.length - 1] : step(-1)
    else if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    e.preventDefault()
    focusValue(next.value)
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn(styles.group, className)}>
      <List>
        {options.map((o, i) => {
          const checked = o.value === value
          return (
            <ListRow
              key={o.value}
              stack
              role="radio"
              aria-checked={checked}
              aria-label={o.label}
              data-choice={o.value}
              tabIndex={o.disabled ? -1 : tabIndexOf(i)}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              leading={o.leading}
              title={o.title}
              subtitle={o.subtitle}
              value={o.detail}
              valueSub={o.detailSub}
              trailing={<Radio checked={checked} />}
              className={cn(styles.option, o.disabled && styles.disabled)}
            />
          )
        })}
      </List>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  )
}
