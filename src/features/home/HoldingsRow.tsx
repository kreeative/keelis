/**
 * Compact stand-in for the crypto book: overlapping monograms, a count, and a chevron.
 * Sits between the accounts and the activity list on the dashboard.
 */
import { api } from '@/api'
import type { Holding } from '@/api/types'
import { AvatarStack, Card, Icon, Money, Skeleton } from '@/components'
import { QK, useQuery } from '@/store'
import styles from './HoldingsRow.module.css'

export function HoldingsRow() {
  const holdings = useQuery<Holding[]>(QK.holdings, () => api.crypto.holdings())
  if (holdings.loading && !holdings.data) return <Skeleton shape="card" height={72} />
  const items = holdings.data ?? []
  if (items.length === 0) return null
  const total = items.reduce((s, h) => s + h.value, 0)
  const count = items.length
  return (
    <Card to="/crypto" padding="md" elevation={1} className={styles.row} label={`${count} actifs crypto, voir le détail`}>
      <AvatarStack assets items={items.map((h) => h.symbol)} label={`${count} actifs détenus`} />
      <span className={styles.text}>
        {count} actif{count > 1 ? 's' : ''}
      </span>
      <Money value={total} className={styles.value} />
      <Icon name="chevron-right" className={styles.chevron} />
    </Card>
  )
}
