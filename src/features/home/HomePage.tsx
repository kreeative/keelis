/**
 * Accueil — the total balance is the hero. Below it: three accounts,
 * three quick actions, the five most recent transactions.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AmountDisplay, Button, EmptyState, ErrorState, Icon, List, QuickActions, SkeletonRow, Wordmark } from '@/components'
import { TransactionRow, useAccounts, useNotifications, useTransactions } from '@/features/shared'
import { QK, useSettings } from '@/store'
import { AccountCards } from './AccountCards'
import { useLiveQuery } from './useLiveQuery'
import styles from './HomePage.module.css'

const RECENT_COUNT = 5

export default function HomePage() {
  const navigate = useNavigate()
  const { hidden, toggleHidden } = useSettings()
  const accounts = useLiveQuery(useAccounts(), QK.accounts)
  const recent = useLiveQuery(useTransactions('recent'), QK.transactions('recent'))
  const notifications = useLiveQuery(useNotifications(), QK.notifications)
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0

  const totals = useMemo(() => {
    if (!accounts.data) return undefined
    const balance = accounts.data.reduce((s, a) => s + a.balance, 0)
    const change = accounts.data.reduce((s, a) => s + a.change24h, 0)
    const previous = balance - change
    return { balance, change, pct: previous > 0 ? (change / previous) * 100 : 0 }
  }, [accounts.data])

  const recentItems = recent.data?.slice(0, RECENT_COUNT)

  return (
    <div className="page">
      <header className={styles.topbar}>
        <Wordmark size="sm" />
        <div className={styles.topActions}>
          <Button variant="ghost" iconOnly aria-label="Masquer les soldes" aria-pressed={hidden} onClick={toggleHidden} className={styles.iconBtn}>
            <Icon name={hidden ? 'eye-off' : 'eye'} />
          </Button>
          <Link to="/notifications" className={styles.iconLink} aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}>
            <Icon name="bell" />
            {unread > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
          </Link>
        </div>
        <p className="sr-only" role="status">
          {hidden ? 'Soldes masqués' : 'Soldes affichés'}
        </p>
      </header>

      <section className={styles.hero} aria-busy={accounts.loading || undefined}>
        <h1 className="t-label">Solde total</h1>
        {accounts.error && !accounts.data ? (
          <ErrorState compact error={accounts.error} onRetry={() => void accounts.refetch()} />
        ) : (
          <AmountDisplay value={totals?.balance} delta={totals?.change} deltaPct={totals?.pct} period="Aujourd'hui" />
        )}
      </section>

      {accounts.error && !accounts.data ? null : <AccountCards accounts={accounts.data} loading={accounts.loading} />}

      <QuickActions
        className={styles.actions}
        actions={[
          { label: 'Ajouter des fonds', icon: <Icon name="plus" />, to: '/fonds' },
          { label: 'Envoyer', icon: <Icon name="send" />, to: '/envoyer' },
          { label: 'Acheter crypto', icon: <Icon name="chart-line" />, to: '/crypto' },
        ]}
      />

      <section className={styles.section} aria-busy={recent.loading || undefined}>
        <div className={styles.sectionHead}>
          <h2 className="t-label">Activité récente</h2>
          <Link to="/activite" className={styles.seeAll}>
            Tout voir
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        {recent.loading ? (
          <SkeletonRow count={RECENT_COUNT} />
        ) : recent.error && !recentItems ? (
          <ErrorState compact error={recent.error} onRetry={() => void recent.refetch()} />
        ) : recentItems && recentItems.length > 0 ? (
          <List>
            {recentItems.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </List>
        ) : (
          <EmptyState
            compact
            message="Aucune transaction pour l'instant."
            action={
              <Button variant="secondary" onClick={() => navigate('/fonds')}>
                Ajouter des fonds
              </Button>
            }
          />
        )}
      </section>
    </div>
  )
}
