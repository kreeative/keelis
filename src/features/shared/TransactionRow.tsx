/**
 * One transaction as a ListRow. Used by Accueil, Chèque, Épargne, Crypto.
 * Leading: merchant initials for card payments, otherwise a directional icon in a circle.
 */
import type { Transaction } from '@/api/types'
import { TYPE_LABELS } from '@/api'
import { Avatar, Badge, Icon, ListRow, Money, type IconName } from '@/components'
import { formatCrypto, formatTime } from '@/lib/format'
import { useSettings } from '@/store'
import { cn } from '@/lib/cn'
import styles from './TransactionRow.module.css'

const INCOMING: Transaction['type'][] = ['transfer_in', 'etransfer_in', 'deposit', 'interest', 'crypto_sell', 'crypto_receive', 'refund']

export function isIncoming(t: Transaction): boolean {
  return INCOMING.includes(t.type) || t.amount > 0
}

export function transactionIcon(t: Transaction): { name: IconName; tone: 'neutral' | 'accent' } {
  switch (t.type) {
    case 'card':
      return { name: 'credit-card', tone: 'neutral' }
    case 'interest':
      return { name: 'trending-up', tone: 'accent' }
    case 'recurring_buy':
      return { name: 'repeat', tone: 'neutral' }
    case 'crypto_buy':
      return { name: 'arrow-up-right', tone: 'neutral' }
    case 'crypto_sell':
      return { name: 'arrow-down-left', tone: 'accent' }
    case 'deposit':
    case 'transfer_in':
    case 'etransfer_in':
    case 'refund':
    case 'crypto_receive':
      return { name: 'arrow-down-left', tone: 'accent' }
    default:
      return { name: 'arrow-up-right', tone: 'neutral' }
  }
}

export function transactionSubtitle(t: Transaction, locale: 'fr-CA' | 'en-CA'): string {
  const parts: string[] = []
  if (t.asset) parts.push(formatCrypto(t.asset.quantity, t.asset.symbol, { locale }))
  else parts.push(TYPE_LABELS[t.type])
  parts.push(formatTime(t.date, { locale }))
  return parts.join(' · ')
}

export function TransactionLeading({ tx }: { tx: Transaction }) {
  if (tx.type === 'card' || tx.type === 'refund') return <Avatar label={tx.counterparty} />
  const icon = transactionIcon(tx)
  return (
    <span className={cn(styles.circle, icon.tone === 'accent' && styles.accent)} aria-hidden="true">
      <Icon name={icon.name} size={20} />
    </span>
  )
}

export function TransactionRow({ tx, to }: { tx: Transaction; to?: string }) {
  const { locale } = useSettings()
  const pending = tx.status === 'pending'
  const failed = tx.status === 'failed' || tx.status === 'reversed'
  const incoming = isIncoming(tx)
  return (
    <ListRow
      to={to ?? `/transactions/${tx.id}`}
      leading={<TransactionLeading tx={tx} />}
      title={tx.counterparty}
      subtitle={transactionSubtitle(tx, locale)}
      value={<Money value={tx.amount} signed={incoming} tone={incoming && !failed} className={failed ? styles.failed : undefined} />}
      valueSub={pending ? <Badge tone="neutral">En attente</Badge> : failed ? <Badge tone="neg">{tx.status === 'reversed' ? 'Annulée' : 'Échouée'}</Badge> : undefined}
      muted={pending}
      chevron={false}
    />
  )
}
