/**
 * The account cards on Accueil: label, balance, one quiet line of context — and **no
 * chart**. The curve at the top of the screen is the one that summarises the whole
 * wealth; a second, smaller curve on a tile it does not belong to competes with it and
 * says less. Direction on a card is carried by the signed figure alone.
 *
 * **There used to be a separate « Actifs » row above the Crypto card, and it printed the
 * same number twice.** The holdings book *is* the investment account, so the row's total
 * and the card's balance were the identical figure, eleven millimetres apart. They are one
 * card now: « Actifs », carrying the marks of what is held — which was the only thing the
 * row said that the card did not.
 */
import type { Account, AccountKind, Holding } from '@/api/types'
import { AvatarStack, Badge, Card, Delta, Money, MoneyDelta, Skeleton } from '@/components'
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

function AccountCard({ account, to, holdings }: { account: Account; to: string; holdings?: Holding[] }) {
  const { locale } = useSettings()
  const isInvest = account.kind === 'crypto'
  const isSavings = account.kind === 'savings'
  const marks = isInvest ? holdings : undefined
  return (
    <Card to={to} className={styles.card}>
      <span className={styles.inner}>
        <span className={styles.head}>
          <span className="t-name">{account.name}</span>
          {isSavings && account.apy !== undefined ? <Badge>APY {formatPercent(account.apy, { locale, signed: false })}</Badge> : null}
          {/* What is held, as marks: a logo is how somebody finds Sonatel in a list without
              reading, and it is the one thing the card could not say in figures. */}
          {marks && marks.length > 0 ? <AvatarStack assets items={marks.map((h) => h.symbol)} label={`${marks.length} actifs détenus`} /> : null}
        </span>
        <span className={styles.balance}>
          <Money value={account.balance} currency={account.currency} />
        </span>
        <span className={styles.sub}>
          {/* Money *and* percent: a percentage on its own does not say whether the move was
              worth 4 000 F CFA or 400 000. */}
          {isInvest ? <Delta value={account.change24hPct} amount={account.change24h} suffix="24 h" variant="pill" /> : <MoneyDelta value={account.change24h} suffix="aujourd'hui" />}
        </span>
      </span>
    </Card>
  )
}

export function AccountCards({ accounts, loading, holdings }: { accounts: Account[] | undefined; loading: boolean; holdings?: Holding[] }) {
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
        return <AccountCard key={o.kind} account={account} to={o.to} holdings={holdings} />
      })}
    </section>
  )
}
