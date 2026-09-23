/**
 * Labelled input. Label above (12px label style). Focus = 2px accent ring.
 * Supports input and textarea. **There is no `SelectField`** — the owner asked for no
 * dropdowns anywhere, and `Picker` replaced the five that existed: a native `<select>` is
 * the one control in the app that cannot be themed, cannot show what an option costs or
 * takes, and on a phone opens an OS wheel over the form.
 *
 * A message under the field carries an icon, as the kit's field states do: with no hue
 * in the palette, « Success message » and « Error message » would otherwise be the same
 * grey line of 14px text. The glyph is the difference.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'
import styles from './Field.module.css'

interface BaseProps {
  label: string
  hint?: string
  error?: string
  /** Confirmation under the field — the kit's success state */
  success?: string
  /** A caution that does not block submission — the kit's warning state. Unlike an
      error it leaves the field's own border alone; only the message says something. */
  warning?: string
  /** Visually hide the label (still announced) */
  hideLabel?: boolean
  /** Leading adornment (icon or text) */
  leading?: ReactNode
  /** Draw the leading mark on a disc, the way the reference's fields do. */
  chip?: boolean
  /**
   * A pill rather than a rounded box, and a little taller. The reference's fields are pills
   * because they hold a pill *inside* them — the secondary action sits in the field, at the
   * end of the line it acts on, and a 44px pill needs a 52px field to sit in with air on
   * both sides. A box at `--r-field` would draw a capsule inside a rounded rectangle, two
   * radii arguing over eight pixels.
   */
  pill?: boolean
  /** Trailing adornment (button, text) */
  trailing?: ReactNode
  className?: string
}

type MessageKind = 'hint' | 'success' | 'warning' | 'error'

const MESSAGE: Record<Exclude<MessageKind, 'hint'>, { icon: IconName; cls: string; role: 'alert' | 'status' }> = {
  success: { icon: 'checkmark-filled', cls: 'success', role: 'status' },
  warning: { icon: 'warning', cls: 'warning', role: 'status' },
  error: { icon: 'circle-alert', cls: 'error', role: 'alert' },
}

/** The line under a field: hint (quiet, no glyph), success, warning, or error. */
function Message({ id, kind, children }: { id?: string; kind: MessageKind; children: ReactNode }) {
  if (kind === 'hint') {
    return (
      <p id={id} className={styles.hint}>
        {children}
      </p>
    )
  }
  const m = MESSAGE[kind]
  return (
    <p id={id} className={styles[m.cls]} role={m.role}>
      <Icon name={m.icon} size={16} className={styles.messageIcon} />
      <span>{children}</span>
    </p>
  )
}

export interface FieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, success, warning, hideLabel, leading, chip = false, pill = false, trailing, className, id, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  const describedBy = [hint ? `${inputId}-hint` : null, success ? `${inputId}-success` : null, warning ? `${inputId}-warning` : null, error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn(styles.field, error && styles.hasError, pill && styles.pill, className)}>
      <label htmlFor={inputId} className={cn(styles.label, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className={styles.control}>
        {leading ? <span className={cn(styles.adornment, chip && styles.chip)}>{leading}</span> : null}
        <input ref={ref} id={inputId} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
        {trailing ? <span className={cn(styles.adornment, styles.trailing)}>{trailing}</span> : null}
      </div>
      {hint && !error && !success && !warning ? (
        <Message id={`${inputId}-hint`} kind="hint">
          {hint}
        </Message>
      ) : null}
      {success && !error ? (
        <Message id={`${inputId}-success`} kind="success">
          {success}
        </Message>
      ) : null}
      {warning && !error ? (
        <Message id={`${inputId}-warning`} kind="warning">
          {warning}
        </Message>
      ) : null}
      {error ? (
        <Message id={`${inputId}-error`} kind="error">
          {error}
        </Message>
      ) : null}
    </div>
  )
})

export interface TextAreaFieldProps extends BaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({ label, hint, error, success, warning, hideLabel, className, id, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className={cn(styles.field, error && styles.hasError, className)}>
      <label htmlFor={inputId} className={cn(styles.label, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className={styles.control}>
        <textarea ref={ref} id={inputId} className={cn(styles.input, styles.textarea)} aria-invalid={error ? true : undefined} {...rest} />
      </div>
      {hint && !error && !success && !warning ? <Message kind="hint">{hint}</Message> : null}
      {success && !error ? <Message kind="success">{success}</Message> : null}
      {warning && !error ? <Message kind="warning">{warning}</Message> : null}
      {error ? <Message kind="error">{error}</Message> : null}
    </div>
  )
})
