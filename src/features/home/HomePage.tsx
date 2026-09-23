/**
 * Accueil — the total balance is the hero, with its own chart underneath.
 * Desktop: main column (hero, chart, activity) + side panel (accounts, crypto).
 * Mobile: one column, same order.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { ChartRange, PriceHistory } from '@/api/types'
import { AmountDisplay, AppBar, Button, Card, Chart, EmptyState, ErrorState, Icon, List, SectionHeader, SegmentedControl, SkeletonRow } from '@/components'
import { TransactionRow, useAccounts, useTransactions } from '@/features/shared'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { QK, useDesktop, useQuery, useSettings } from '@/store'
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
  { value: 'MAX', label: 'All', period: 'Depuis le début' },
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
  /* No `useHoldings()` here any more. It existed solely for the marks on the Actifs card,
     and with those gone the query was a request Accueil made on every visit for something
     nothing rendered. */
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
  const hello = `${greeting()}${user ? `, ${user.firstName}` : ''}`
  const wide = useDesktop()

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main} data-cascade>
          {/* The canvas: a dark island that holds the balance, the two actions people
              actually take, and the curve. It redefines the tokens its children read, so
              everything inside behaves as it would on a dark theme. */}
          <section className={styles.canvas} aria-busy={accounts.loading || undefined}>
            {/* The bar lives on the canvas, not above it: the bell and the avatar belong
                to the dark ground. From 768px the rail carries those two links and the bar
                keeps only the greeting, which is the page's heading at every width.

                There used to be a second copy of the greeting in a desktop-only <header>
                above the canvas, with « Ajouter des fonds » and « Envoyer » beside it — and
                none of the three was ever visible: `.canvas::before` carries the canvas
                colour 100vh up past its own top edge so an iOS overscroll shows more canvas
                instead of a seam, and being positioned it paints over a static sibling. Two
                buttons that were focusable, clickable and invisible, duplicating the two at
                the canvas's foot. */}
            <AppBar title={hello} className={styles.canvasBar} />

            <div className={styles.heroTop}>
              <p className={styles.canvasLabel}>Solde total</p>
              <Button variant="ghost" iconOnly aria-label={hidden ? 'Afficher les soldes' : 'Masquer les soldes'} aria-pressed={hidden} onClick={toggleHidden} className={styles.eye}>
                <Icon name={hidden ? 'eye-off' : 'eye'} size={20} />
              </Button>
            </div>
            {accounts.error && !accounts.data ? (
              <ErrorState compact error={accounts.error} onRetry={() => void accounts.refetch()} />
            ) : (
              /* `animate` off while scrubbing: between two scrubbed values the number has
                 to keep up with the finger, and counting would lag it into nonsense. */
              <AmountDisplay value={heroValue} delta={heroDelta} deltaPct={heroPct} period={hover ? undefined : period?.period} caption={heroCaption} animate={!hover} />
            )}

            <div className={styles.chartBlock} aria-label="Évolution du solde total">
              <Chart
                points={history.data?.points ?? []}
                height={wide ? 190 : 132}
                label={`Solde total, ${period?.period.toLowerCase() ?? range}`}
                loading={history.loading && !history.data}
                onHover={setHover}
                formatValue={(v) => (hidden ? '••••' : formatMoney(v, { locale }))}
                formatTime={(t) => (range === '1D' ? formatDateTime(t, { locale }) : formatDate(t, { locale }))}
              />
              <SegmentedControl segments={RANGES.map((r) => ({ value: r.value, label: r.label }))} value={range} onChange={setRange} label="Période du graphique" size="sm" bare />
            </div>

            {/* The two actions sit at the foot of the canvas, under the curve: the balance
                and its shape are what the screen is for, and the actions are what you do
                after reading them. */}
            <div className={styles.canvasActions}>
              <Button size="lg" icon={<Icon name="send" size={18} />} onClick={() => navigate('/envoyer')}>
                Envoyer
              </Button>
              <Button size="lg" variant="secondary" icon={<Icon name="plus" size={18} />} onClick={() => navigate('/fonds')}>
                Ajouter
              </Button>
            </div>
          </section>

          {/* The sheet rides up over the canvas, the way a bottom sheet does. */}
          {/* The aurora wash used to drift here: five pale coloured fields under the sheet,
              in the light theme only. It was the one place the palette let a hue be
              decorative, and it is the first thing to go when the brief is plain colours —
              a slow gradient behind the content is exactly the look the owner named. */}
          <div className={styles.sheet}>
            <span className={styles.grab} aria-hidden="true" />

            <div className={styles.asideMobile}>
              <AccountCards accounts={accounts.data} loading={accounts.loading} />
            </div>

            <section className={styles.section} aria-busy={recent.loading || undefined}>
            <SectionHeader title="Activité récente" action={{ label: 'Tout voir', to: '/activite', icon: 'arrow-right' }} />
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
        </div>

        <aside className={styles.aside} data-cascade>
          <AccountCards accounts={accounts.data} loading={accounts.loading} />
          <HoldingsPanel />
        </aside>
      </div>
    </div>
  )
}
