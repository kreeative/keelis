/**
 * The holdings book in one row: overlapping marks, a count, the value and how it is
 * doing. It sits **above** the Crypto card on Accueil — the holdings are what this app is
 * principally about, so they come before the wallet that happens to hold some of them.
 */
import { api } from '@/api'
import type { Holding } from '@/api/types'
import { AvatarStack, Card, Delta, Icon, Money, Skeleton } from '@/components'
import { QK, useQuery } from '@/store'
import styles from './HoldingsRow.module.css'

export function HoldingsRow() {
  const holdings = useQuery<Holding[]>(QK.holdings, () => api.crypto.holdings())
  if (holdings.loading && !holdings.data) return <Skeleton shape="card" height={72} />
  const items = holdings.data ?? []
  if (items.length === 0) return null
  const total = items.reduce((s, h) => s + h.value, 0)
  const pnl = items.reduce((s, h) => s + h.pnl, 0)
  // Against the cost basis, not against the market value: a portfolio up 10 000 on a
  // 100 000 basis is up 10 %, not 9.09 %.
  const basis = total - pnl
  const pnlPct = basis > 0 ? (pnl / basis) * 100 : 0
  const count = items.length
  return (
    <Card to="/crypto" padding="md" elevation={1} className={styles.row} label={`${count} actifs, voir le détail`}>
      <AvatarStack assets items={items.map((h) => h.symbol)} label={`${count} actifs détenus`} />
      <span className={styles.text}>
        {count} actif{count > 1 ? 's' : ''}
      </span>
      {/* No sparkline here either — the figure and its sign say how the book is doing, and
          the curve that summarises the whole wealth is already at the top of the screen. */}
      <span className={styles.figures}>
        <Money value={total} className={styles.value} />
        <Delta value={pnlPct} amount={pnl} className={styles.delta} />
      </span>
      <Icon name="chevron-right" className={styles.chevron} />
    </Card>
  )
}
