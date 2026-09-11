/**
 * Accueil — the total balance is the hero, with its own chart underneath.
 * Desktop: main column (hero, chart, activity) + side panel (accounts, crypto).
 * Mobile: one column, same order.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { ChartRange, PriceHistory } from '@/api/types'
import { AmountDisplay, Button, Card, Chart, EmptyState, ErrorState, Icon, List, QuickActions, SegmentedControl, SkeletonRow } from '@/components'
import { TransactionRow, useAccounts, useTransactions } from '@/features/shared'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { useSession } from '@/store/session'
import { AccountCards } from './AccountCards'
import { HoldingsPanel } from './HoldingsPanel'
import styles from './HomePage.module.css'

const RECENT_COUNT = 5

const RANGES: ReadonlyArray<{ value: ChartRange; label: string; period: string }> = [
  { value: '1D', label: '1J', period: "Aujourd'hui" },
  { value: '1W', label: '1S', period: '1 semaine' },
  { value: '1M', label: '1M', period: '1 mois' },
  { value: '1Y', label: '1A', period: '1 an' },
  { value: 'MAX', label: 'Max', period: 'Depuis le début' },
]

function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function HomePage() {
  const navigate = useNavigate()
  const { hidden, toggleHidden, locale } = useSettings()
  const { user } = useSession()
  const [range, setRange] = useState<ChartRange>('1M')
  const [hover, setHover] = useState<{ t: number; p: number } | null>(null)

  const accounts = useAccounts()
  const recent = useTransactions('recent')
  const history = useQuery<PriceHistory>(QK.accountsHistory(range), () => api.accounts.history(range), { staleTime: 30_000 })

  const totals = useMemo(() => {
    if (!accounts.data) return undefined
    const balance = accounts.data.reduce((s, a) => s + a.balance, 0)
    const change = accounts.data.reduce((s, a) => s + a.change24h, 0)
    const previous = balance - change
    return { balance, change, pct: previous > 0 ? (change / previous) * 100 : 0 }
  }, [accounts.data])

  const period = RANGES.find((r) => r.value === range)
  const showRangeDelta = range !== '1D' && history.data !== undefined
  const heroValue = hover ? hover.p : totals?.balance
  const heroDelta = hover ? undefined : showRangeDelta ? history.data!.change : totals?.change
  const heroPct = hover ? undefined : showRangeDelta ? history.data!.changePct : totals?.pct
  const heroCaption = hover ? formatDateTime(hover.t, { locale }) : undefined

  const recentItems = recent.data?.slice(0, RECENT_COUNT)

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <header className={styles.head}>
            <h1 className={`t-h2 ${styles.greeting}`}>
              {greeting()}
              {user ? `, ${user.firstName}` : ''}
            </h1>
            <div className={styles.headActions}>
              <Button variant="secondary" icon={<Icon name="plus" size={18} />} onClick={() => navigate('/fonds')}>
                Ajouter des fonds
              </Button>
              <Button variant="secondary" icon={<Icon name="send" size={18} />} onClick={() => navigate('/envoyer')} className={styles.headSend}>
                Envoyer
              </Button>
            </div>
          </header>

          <section className={styles.hero} aria-busy={accounts.loading || undefined}>
            <div className={styles.heroTop}>
              <p className="t-label">Solde total</p>
              <Button variant="ghost" iconOnly aria-label={hidden ? 'Afficher les soldes' : 'Masquer les soldes'} aria-pressed={hidden} onClick={toggleHidden} className={styles.eye}>
                <Icon name={hidden ? 'eye-off' : 'eye'} size={20} />
              </Button>
            </div>
            {accounts.error && !accounts.data ? (
              <ErrorState compact error={accounts.error} onRetry={() => void accounts.refetch()} />
            ) : (
              <AmountDisplay value={heroValue} delta={heroDelta} deltaPct={heroPct} period={hover ? undefined : period?.period} caption={heroCaption} />
            )}
          </section>

          <section className={styles.chartBlock} aria-label="Évolution du solde total">
            <Chart
              points={history.data?.points ?? []}
              height={200}
              label={`Solde total, ${period?.period.toLowerCase() ?? range}`}
              loading={history.loading && !history.data}
              onHover={setHover}
              formatValue={(v) => (hidden ? '••••' : formatMoney(v, { locale }))}
              formatTime={(t) => (range === '1D' ? formatDateTime(t, { locale }) : formatDate(t, { locale }))}
            />
            <SegmentedControl segments={RANGES.map((r) => ({ value: r.value, label: r.label }))} value={range} onChange={setRange} label="Période du graphique" size="sm" />
          </section>

          <div className={styles.asideMobile}>
            <AccountCards accounts={accounts.data} loading={accounts.loading} />
          </div>

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
              <Card padding="md" elevation={1}>
                <SkeletonRow count={RECENT_COUNT} />
              </Card>
            ) : recent.error && !recentItems ? (
              <ErrorState compact error={recent.error} onRetry={() => void recent.refetch()} />
            ) : recentItems && recentItems.length > 0 ? (
              <Card padding="md" elevation={1}>
                <List>
                  {recentItems.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </List>
              </Card>
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

        <aside className={styles.aside}>
          <AccountCards accounts={accounts.data} loading={accounts.loading} />
          <HoldingsPanel />
        </aside>
      </div>
    </div>
  )
}
