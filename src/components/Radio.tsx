/**
 * The radio from the kit's universal-row trailing set: an outline ring when unselected,
 * a filled disc with a punched-out centre when selected. Presentational only — the row
 * around it carries `role="radio"` and `aria-checked`, so this is hidden from the tree.
 */
import { cn } from '@/lib/cn'
import styles from './Radio.module.css'

export function Radio({ checked, className }: { checked: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn(styles.radio, checked && styles.checked, className)} />
}
