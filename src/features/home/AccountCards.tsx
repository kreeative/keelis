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
 * **No chart, and no preview of the holdings.** The curve at the top of the screen
 * summarises the whole wealth; a second, smaller curve on a tile competes with it and says
 * less. The card used to carry an `AvatarStack` of the asset marks, and the owner asked for
 * it to go: on a row whose job is « this account, this much », a strip of logos is the one
 * element that answers neither, and it was squeezing the account's own name at 320px. What
 * is held belongs on the page the row leads to.
 *
 * There are four now. « Actifs » held African equities *and* crypto until the owner asked
 * for crypto to stand on its own, which is how a bank that offers both keeps them: one is a
 * regulated security on a local exchange, the other is not.
 */
import type { Account, AccountKind } from '@/api/types'
import { Card, Money, Skeleton } from '@/components'
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

function AccountCard({ account, to }: { account: Account; to: string }) {
  const { locale } = useSettings()
  const invests = INVESTS.has(account.kind)
  const up = account.change24hPct >= 0
  return (
    <Card to={to} padding="md" className={styles.card}>
      <span className={styles.row}>
        <span className={styles.left}>
          <span className={styles.name}>{account.name}</span>
        </span>
        <span className={styles.right}>
          {/* `compact` abbreviates only a figure that would not fit — « 24,325,824 F CFA »
              becomes « 24.3 M F CFA », truncated rather than rounded, so it can never claim
              money the account does not hold. Anything shorter is left exact. */}
          <span className={styles.balance}>
            <Money value={account.balance} currency={account.currency} compact />
          </span>
          {/* The second line of the right column: a direction for the two investment
              accounts, nothing for the two cash ones. Direction is a sign and a colour and
              nothing else — the money figure that used to accompany it repeated the
              percentage in another unit.

              Épargne used to carry a « 4,00 % par an » badge here and the owner asked for
              it to go. It was the only thing on any row that was not this account's own
              money: a rate is a property of the product, identical on every visit, and it
              sat where the eye goes for the balance. It is still said where it is being
              acted on — the deposit preview computes what a deposit earns at that rate, in
              a sentence, at the moment somebody is deciding. */}
          {invests ? (
            <span className={cn(styles.change, up ? styles.up : styles.down)}>{formatPercent(account.change24hPct, { locale, signed: true })}</span>
          ) : null}
        </span>
      </span>
    </Card>
  )
}

export function AccountCards({ accounts, loading }: { accounts: Account[] | undefined; loading: boolean }) {
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
        return <AccountCard key={o.kind} account={account} to={o.to} />
      })}
    </section>
  )
}
