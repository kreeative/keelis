/**
 * Labelled input. Label above (12px label style). Focus = 2px accent ring.
 * Error under the field in --neg, 14px. Supports input/select/textarea.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import styles from './Field.module.css'

interface BaseProps {
  label: string
  hint?: string
  error?: string
  /** Visually hide the label (still announced) */
  hideLabel?: boolean
  /** Leading adornment (icon or text) */
  leading?: ReactNode
  /** Trailing adornment (button, text) */
  trailing?: ReactNode
  className?: string
}

export interface FieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, hideLabel, leading, trailing, className, id, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn(styles.field, error && styles.hasError, className)}>
      <label htmlFor={inputId} className={cn(styles.label, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className={styles.control}>
        {leading ? <span className={styles.adornment}>{leading}</span> : null}
        <input ref={ref} id={inputId} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
        {trailing ? <span className={cn(styles.adornment, styles.trailing)}>{trailing}</span> : null}
      </div>
      {hint && !error ? (
        <p id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})

export interface SelectFieldProps extends BaseProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  children: ReactNode
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, hint, error, hideLabel, leading, trailing, className, id, children, ...rest }, ref) {
  const auto = useId()
  const inputId = id ?? auto
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn(styles.field, error && styles.hasError, className)}>
      <label htmlFor={inputId} className={cn(styles.label, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className={styles.control}>
        {leading ? <span className={styles.adornment}>{leading}</span> : null}
        <span className={styles.selectWrap}>
          <select ref={ref} id={inputId} className={cn(styles.input, styles.select)} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>
            {children}
          </select>
          <Icon name="chevron-down" size={18} className={styles.selectChevron} />
        </span>
        {trailing ? <span className={cn(styles.adornment, styles.trailing)}>{trailing}</span> : null}
      </div>
      {hint && !error ? (
        <p id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})

export interface TextAreaFieldProps extends BaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({ label, hint, error, hideLabel, className, id, ...rest }, ref) {
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
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})
