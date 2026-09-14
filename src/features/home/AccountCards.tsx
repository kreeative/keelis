/**
 * The account cards on Accueil: name on the left, balance on the right, one line each.
 *
 * **They were stacked tiles and they carried a delta.** Every card printed its
 * twenty-four-hour movement — « −56,675 F CFA · 24 h » under Chèque, « +912 F CFA » under
 * Épargne — and the owner asked for that to go on the cash accounts. It was never a return:
 * a chequing balance moves because you spent, and calling that a loss in red is a small lie
 * told four times a day. The investment accounts keep direction, but as **a signed
 * percentage and nothing else**: the money figure beside it was the widest thing on the row
 * and said the same thing twice.
 *
 * **No chart either.** The curve at the top of the screen summarises the whole wealth; a
 * second, smaller curve on a tile competes with it and says less.
 *
 * There are four now. « Actifs » held African equities *and* crypto until the owner asked
 * for crypto to stand on its own, which is how a bank that offers both keeps them: one is a
 * regulated security on a local exchange, the other is not.
 */
import type { Account, AccountKind, Holding } from '@/api/types'
import { AvatarStack, Badge, Card, Money, Skeleton } from '@/components'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useSettings } from '@/store'
import styles from './AccountCards.module.css'

/* Fixed order, by kind rather than by id: the ids belong to whichever back-end answers. */
const ORDER: ReadonlyArray<{ kind: AccountKind; to: string }> = [
  { kind: 'checking', to: '/carte' },
  { kind: 'savings', to: '/epargne' },
  { kind: 'investing', to: '/crypto' },
  { kind: 'crypto', to: '/crypto?classe=crypto' },
]

/* A row, not a tile. */
const SKELETON_HEIGHT = 76

/** Where the money sits and the movement is a return rather than a week's spending. */
const INVESTS = new Set<AccountKind>(['investing', 'crypto'])

function AccountCard({ account, to, holdings }: { account: Account; to: string; holdings?: Holding[] }) {
  const { locale } = useSettings()
  const invests = INVESTS.has(account.kind)
  const up = account.change24hPct >= 0
  const marks = account.kind === 'investing' ? holdings : undefined
  return (
    <Card to={to} padding="md" className={styles.card}>
      <span className={styles.row}>
        <span className={styles.left}>
          <span className={styles.name}>{account.name}</span>
          {/* What is held, as marks: a logo is how somebody finds Sonatel in a list without
              reading, and it is the one thing the card could not say in figures. It gives way
              below 360px, where it was squeezing « Actifs » down to twelve pixels — an
              account whose name has disappeared is worse off than one without its logos. */}
          {marks && marks.length > 0 ? <AvatarStack assets items={marks.map((h) => h.symbol)} label={`${marks.length} actifs détenus`} className={styles.marks} /> : null}
        </span>
        <span className={styles.right}>
          {/* `compact` abbreviates only a figure that would not fit — « 24,325,824 F CFA »
              becomes « 24.3 M F CFA », truncated rather than rounded, so it can never claim
              money the account does not hold. Anything shorter is left exact. */}
          <span className={styles.balance}>
            <Money value={account.balance} currency={account.currency} compact />
          </span>
          {/* The second line of the right column: a rate for Épargne, a direction for the two
              investment accounts, nothing for Chèque. The APY badge used to sit beside the
              name and took so much of the left side that at 320px « Épargne » rendered at
              zero width. Direction is a sign and a colour and nothing else — the money figure
              that used to accompany it repeated the percentage in another unit. */}
          {account.kind === 'savings' && account.apy !== undefined ? (
            <Badge>APY {formatPercent(account.apy, { locale, signed: false })}</Badge>
          ) : invests ? (
            <span className={cn(styles.change, up ? styles.up : styles.down)}>{formatPercent(account.change24hPct, { locale, signed: true })}</span>
          ) : null}
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
