/** 40px circle holding one icon — the leading element of every réglages row. */
import { Icon, type IconName } from '@/components'
import { cn } from '@/lib/cn'
import styles from './RowIcon.module.css'

export function RowIcon({ name, tone = 'neutral' }: { name: IconName; tone?: 'neutral' | 'accent' }) {
  return (
    <span className={cn(styles.circle, tone === 'accent' && styles.accent)} aria-hidden="true">
      <Icon name={name} size={20} />
    </span>
  )
}
