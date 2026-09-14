/**
 * The other currencies the account holds, under its home balance.
 *
 * The roadmap asks for « multidevise : XOF/USD, NGN/USD côte à côte », and the reason is
 * not completeness — it is that a great many people this app is for are paid in one
 * currency and live in another. A diaspora transfer arrives in euros; rent is due in
 * francs. Holding both, visibly, is the difference between an app that can quote a rate
 * and an app that is useful to that person.
 *
 * Each pocket is a row rather than a card: they are parts of one balance, not accounts
 * beside it, and the home currency stays the hero above. A pocket appears when money first
 * lands in it and disappears when it empties — fifteen zero balances would be a filing
 * cabinet, not a wallet.
 */
import type { Account } from '@/api/types'
import { Card, Icon, List, ListRow, Money } from '@/components'
import { CURRENCIES } from '@/lib/currency'
import styles from './Pockets.module.css'

export function Pockets({ account }: { account: Account | undefined }) {
  const pockets = account?.pockets?.filter((p) => p.amount > 0) ?? []
  if (!account || pockets.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby="pockets-title">
      <h2 className="t-section" id="pockets-title">
        Autres devises
      </h2>
      <Card padding="none" elevation={1}>
        <List>
          {pockets.map((p) => (
            <ListRow
              key={p.currency}
              to={`/convertir?de=${p.currency}`}
              leading={
                <span className={styles.code} aria-hidden="true">
                  {p.currency}
                </span>
              }
              title={CURRENCIES[p.currency].name}
              subtitle={CURRENCIES[p.currency].zone}
              value={<Money value={p.amount} currency={p.currency} />}
              chevron
            />
          ))}
        </List>
      </Card>
      <p className={styles.note}>
        <Icon name="info" size={16} className={styles.noteIcon} />
        Une conversion déplace de l’argent entre ces poches. Le taux et la marge sont affichés avant
        que vous confirmiez.
      </p>
    </section>
  )
}
