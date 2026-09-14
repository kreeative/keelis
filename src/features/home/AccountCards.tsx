/**
 * The account cards on Accueil: label, balance, one quiet line of context — and **no
 * chart**. The curve at the top of the screen is the one that summarises the whole
 * wealth; a second, smaller curve on a tile it does not belong to competes with it and
 * says less. Direction on a card is carried by the signed figure alone.
 *
 * The order is fixed, and `Actifs` sits between Épargne and Crypto: the holdings are what
 * this app is principally about, so they come before the wallet that happens to hold some
 * of them.
 */
import { Fragment, type ReactNode } from 'react'
import type { Account, AccountKind } from '@/api/types'
import { Badge, Card, Delta, Money, MoneyDelta, Skeleton } from '@/components'
import { formatPercent } from '@/lib/format'
import { useSettings } from '@/store'
import styles from './AccountCards.module.css'

/* Fixed order, by kind rather than by id: the ids belong to whichever back-end answers. */
const ORDER: ReadonlyArray<{ kind: AccountKind; to: string }> = [
  { kind: 'checking', to: '/carte' },
  { kind: 'savings', to: '/epargne' },
  { kind: 'crypto', to: '/crypto' },
]

const SKELETON_HEIGHT = 132

function AccountCard({ account, to }: { account: Account; to: string }) {
  const { locale } = useSettings()
  const isCrypto = account.kind === 'crypto'
  const isSavings = account.kind === 'savings'
  return (
    <Card to={to} className={styles.card}>
      <span className={styles.inner}>
        <span className={styles.head}>
          <span className="t-name">{account.name}</span>
          {isSavings && account.apy !== undefined ? <Badge>APY {formatPercent(account.apy, { locale, signed: false })}</Badge> : null}

        </span>
        <span className={styles.balance}>
          <Money value={account.balance} currency={account.currency} />
        </span>
        <span className={styles.sub}>
          {/* Money *and* percent: a percentage on its own does not say whether the move was
              worth 4 000 F CFA or 400 000. */}
          {isCrypto ? <Delta value={account.change24hPct} amount={account.change24h} suffix="24 h" variant="pill" /> : <MoneyDelta value={account.change24h} suffix="aujourd'hui" />}
        </span>
      </span>
    </Card>
  )
}

export function AccountCards({ accounts, loading, beforeCrypto }: { accounts: Account[] | undefined; loading: boolean; beforeCrypto?: ReactNode }) {
  if (!accounts) {
    return (
      <section className={styles.grid} aria-busy={loading || undefined} aria-label="Comptes">
        {ORDER.map((o) => (
          <Skeleton key={o.kind} shape="card" height={SKELETON_HEIGHT} />
        ))}
      </section>
    )
  }
  return (
    <section className={styles.grid} aria-label="Comptes">
      {ORDER.map((o) => {
        const account = accounts.find((a) => a.kind === o.kind)
        if (!account) return null
        return (
          <Fragment key={o.kind}>
            {o.kind === 'crypto' ? beforeCrypto : null}
            <AccountCard account={account} to={o.to} />
          </Fragment>
        )
      })}
    </section>
  )
}
