/**
 * Choosing one value out of a list — without a `<select>`.
 *
 * The owner asked for no dropdowns anywhere. They are also the worst control on this
 * screen: a native `<select>` renders as the operating system's own widget, which means it
 * is the one element in the app that cannot be themed, cannot show what an option *costs*
 * or *takes*, and on a phone opens a wheel that hides the form behind it. Sixteen currencies
 * with their names, or two hundred and fifty countries, are not a list to spin through.
 *
 * So: a row showing what is chosen, and a `Sheet` holding the choices. The sheet is a
 * `ChoiceList` — the app's real radiogroup, one tab stop, arrows move and select — and it
 * gains a search box past `SEARCH_FROM` options, because that is where scanning stops
 * working and typing starts.
 *
 * It is one component for both sizes of problem on purpose. `De` / `Vers` on /convertir has
 * sixteen options and the country list has two hundred and fifty; a picker that was fine for
 * one and wrong for the other is how a second one gets written.
 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ChoiceList, type ChoiceOption } from './ChoiceList'
import { Field } from './Field'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import styles from './Picker.module.css'

/** Past this many options, scanning stops working and the sheet offers a search box. */
const SEARCH_FROM = 8

export interface PickerProps {
  label: string
  options: ChoiceOption[]
  value: string
  onChange: (value: string) => void
  /** Shown in the row when nothing is chosen yet. */
  placeholder?: string
  /** The sheet's own title. Defaults to the label. */
  sheetTitle?: string
  hint?: ReactNode
  error?: string
  disabled?: boolean
  /** Hide the visible label — the row's value carries it (a compact pair, a toolbar). */
  hideLabel?: boolean
  className?: string
}

/** Everything an option says, flattened, so a search matches what somebody can see. */
function haystack(o: ChoiceOption): string {
  return [o.label, o.title, o.subtitle, o.detail, o.detailSub]
    .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
    .join(' ')
    .toLowerCase()
}

export function Picker({ label, options, value, onChange, placeholder = 'Choisir…', sheetTitle, hint, error, disabled = false, hideLabel = false, className }: PickerProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const chosen = options.find((o) => o.value === value)
  const searchable = options.length >= SEARCH_FROM

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    /* Every word has to appear somewhere in the option — « fra eur » finds the euro row for
       France without caring which order they were typed in. */
    const words = q.split(/\s+/)
    return options.filter((o) => {
      const hay = haystack(o)
      return words.every((w) => hay.includes(w))
    })
  }, [options, query])

  return (
    <div className={cn(styles.root, className)}>
      {!hideLabel ? (
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        className={cn(styles.trigger, error && styles.invalid)}
        disabled={disabled}
        /* Named by its label *and* its value, so it announces « Pays, Sénégal » — what a
           `<select>` says, without the widget. The visible label is a sibling `<span>`, not
           a `<label for>`, so without this the button's whole accessible name was the value:
           « Sénégal, button », with nothing saying which field it belonged to. */
        aria-label={hideLabel ? label : undefined}
        aria-labelledby={hideLabel ? undefined : `${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
      >
        <span id={`${id}-value`} className={styles.chosen}>
          {chosen ? (
            <>
              <span className={styles.chosenTitle}>{chosen.title}</span>
              {chosen.subtitle ? <span className={styles.chosenSub}>{chosen.subtitle}</span> : null}
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </span>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </button>
      {error ? (
        <span id={`${id}-error`} className={styles.error}>
          <Icon name="circle-alert" size={16} className={styles.errorIcon} />
          {error}
        </span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
        {searchable ? (
          <Field
            label="Rechercher"
            hideLabel
            placeholder="Rechercher…"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            leading={<Icon name="search" size={20} />}
            className={styles.search}
          />
        ) : null}
        {shown.length > 0 ? (
          <ChoiceList
            label={sheetTitle ?? label}
            options={shown}
            value={value}
            onChange={(v) => {
              onChange(v)
              setOpen(false)
            }}
          />
        ) : (
          <p className={styles.empty}>Aucun résultat pour « {query.trim()} ».</p>
        )}
      </Sheet>
    </div>
  )
}
