/**
 * Three account cards (Chèque, Épargne, Crypto) in a fixed order.
 * Each card: label, balance in h2, one quiet line of context.
 */
import type { Account } from '@/api/types'
import { IDS } from '@/api'
import { Badge, Card, Delta, Money, Skeleton, Sparkline } from '@/components'
import { formatPercent } from '@/lib/format'
import { useSettings } from '@/store'
import styles from './AccountCards.module.css'

const ORDER = [
  { id: IDS.checking, to: '/carte' },
  { id: IDS.savings, to: '/epargne' },
  { id: IDS.crypto, to: '/crypto' },
] as const

const SKELETON_HEIGHT = 132

function AccountCard({ account, to }: { account: Account; to: string }) {
  const { locale } = useSettings()
  const isCrypto = account.kind === 'crypto'
  const isSavings = account.kind === 'savings'
  return (
    <Card to={to} className={styles.card}>
      <span className={styles.inner}>
        <span className={styles.head}>
          <span className="t-label">{account.name}</span>
          {isSavings && account.apy !== undefined ? <Badge>APY {formatPercent(account.apy, { locale, signed: false })}</Badge> : null}
          {isCrypto && account.sparkline ? <Sparkline values={account.sparkline} width={72} height={24} /> : null}
        </span>
        <span className={styles.balance}>
          <Money value={account.balance} currency={account.currency} />
        </span>
        <span className={styles.sub}>
          {isCrypto ? (
            <Delta value={account.change24hPct} suffix="24 h" />
          ) : (
            <>
              <Money value={account.change24h} currency={account.currency} signed />
              <span>aujourd'hui</span>
            </>
          )}
        </span>
      </span>
    </Card>
  )
}

export function AccountCards({ accounts, loading }: { accounts: Account[] | undefined; loading: boolean }) {
  if (!accounts) {
    return (
      <div className={styles.grid} aria-busy={loading || undefined} aria-label="Comptes">
        {ORDER.map((o) => (
          <Skeleton key={o.id} shape="card" height={SKELETON_HEIGHT} />
        ))}
      </div>
    )
  }
  return (
    <div className={styles.grid} aria-label="Comptes">
      {ORDER.map((o) => {
        const account = accounts.find((a) => a.id === o.id)
        return account ? <AccountCard key={o.id} account={account} to={o.to} /> : null
      })}
    </div>
  )
}
