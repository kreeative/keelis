/**
 * Filters for the Chèque transaction list: type chips, amount range, period.
 */
import { useEffect, useState } from 'react'
import { Button, Field, SegmentedControl, Sheet } from '@/components'
import { EMPTY_FILTER, PERIODS, TYPE_CHIPS, type FilterState, type PeriodValue } from './filters'
import styles from './FilterSheet.module.css'

export interface FilterSheetProps {
  open: boolean
  onClose: () => void
  value: FilterState
  onApply: (next: FilterState) => void
}

export function FilterSheet({ open, onClose, value, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<FilterState>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const toggleType = (chip: string) => {
    setDraft((d) => ({ ...d, types: d.types.includes(chip) ? d.types.filter((t) => t !== chip) : [...d.types, chip] }))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtrer"
      footer={
        <>
          <Button size="lg" block onClick={() => onApply(draft)}>
            Appliquer
          </Button>
          <Button variant="ghost" block onClick={() => setDraft(EMPTY_FILTER)}>
            Réinitialiser
          </Button>
        </>
      }
    >
      <section className={styles.block} aria-labelledby="filter-types">
        <h3 id="filter-types" className="t-section">
          Type
        </h3>
        <div className={styles.chips}>
          {TYPE_CHIPS.map((chip) => {
            const pressed = draft.types.includes(chip.value)
            return (
              <button key={chip.value} type="button" className={styles.chip} aria-pressed={pressed} onClick={() => toggleType(chip.value)}>
                {chip.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.block} aria-labelledby="filter-amount">
        <h3 id="filter-amount" className="t-section">
          Montant
        </h3>
        <div className={styles.amounts}>
          <Field
            label="Minimum"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={draft.min}
            onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
          />
          <Field
            label="Maximum"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Sans limite"
            value={draft.max}
            onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
          />
        </div>
      </section>

      <section className={styles.block} aria-labelledby="filter-period">
        <h3 id="filter-period" className="t-section">
          Période
        </h3>
        <SegmentedControl
          segments={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          value={draft.period}
          onChange={(period: PeriodValue) => setDraft((d) => ({ ...d, period }))}
          label="Période des transactions"
          block
        />
      </section>
    </Sheet>
  )
}
