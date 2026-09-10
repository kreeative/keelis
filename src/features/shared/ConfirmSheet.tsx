/**
 * Confirmation sheet for every money movement. Shows every line (amount, fees/spread, total),
 * then a primary button. Errors from the API are shown inline; the sheet stays open.
 */
import type { ReactNode } from 'react'
import type { ApiError } from '@/api/types'
import { Button, Sheet } from '@/components'
import styles from './ConfirmSheet.module.css'

export interface SummaryLine {
  label: ReactNode
  value: ReactNode
  /** Emphasised (total) */
  strong?: boolean
  /** Muted helper under the label */
  hint?: ReactNode
}

export interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Big number at the top of the sheet */
  hero?: ReactNode
  heroCaption?: ReactNode
  lines: SummaryLine[]
  /** Small print under the lines (e.g. spread disclosure) */
  note?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  pending?: boolean
  error?: ApiError | Error | null
  destructive?: boolean
}

export function ConfirmSheet({ open, onClose, title, hero, heroCaption, lines, note, confirmLabel, onConfirm, pending = false, error, destructive = false }: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      locked={pending}
      footer={
        <>
          <Button size="lg" block onClick={onConfirm} loading={pending} variant={destructive ? 'destructive' : 'primary'}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" block onClick={onClose} disabled={pending}>
            Annuler
          </Button>
        </>
      }
    >
      {hero ? (
        <div className={styles.hero}>
          <div className={styles.heroValue}>{hero}</div>
          {heroCaption ? <p className={styles.heroCaption}>{heroCaption}</p> : null}
        </div>
      ) : null}
      <dl className={styles.lines}>
        {lines.map((l, i) => (
          <div key={i} className={l.strong ? styles.lineStrong : styles.line}>
            <dt className={styles.label}>
              {l.label}
              {l.hint ? <span className={styles.hint}>{l.hint}</span> : null}
            </dt>
            <dd className={styles.value}>{l.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className={styles.note}>{note}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}
    </Sheet>
  )
}
