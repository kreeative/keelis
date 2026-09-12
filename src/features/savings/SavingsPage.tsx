/**
 * /epargne — the savings balance is the hero, with its growth curve underneath.
 * Desktop ≥1120px: main column (hero, chart, activité) + sticky side column (intérêts, objectifs).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, IDS } from '@/api'
import type { ChartRange, PriceHistory, PricePoint, SavingsGoal } from '@/api/types'
import { AmountDisplay, AppBar, Badge, Button, Card, Chart, EmptyState, ErrorState, Icon, List, Money, ProgressBar, QuickActions, SectionHeader, SegmentedControl, Skeleton, SkeletonRow } from '@/components'
import { TransactionRow, useAccount, useGoals, useSavings, useTransactions } from '@/features/shared'
import { MASKED, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { formatApy, formatMonthYear, formatWholePercent, goalPercent, goalProgress, inlineMoney, unallocated } from './savingsUtils'
import { useMediaQuery } from './hooks'
import styles from './SavingsPage.module.css'

const RECENT_COUNT = 5

const RANGES: ReadonlyArray<{ value: ChartRange; label: string; period: string }> = [
  { value: '1M', label: '1 M', period: '1 mois' },
  { value: '1Y', label: '1 A', period: '1 an' },
  { value: 'MAX', label: 'Max', period: 'Depuis le début' },
]

function StatCell({ label, value, tone = false, failed }: { label: string; value: number | undefined; tone?: boolean; failed: boolean }) {
  return (
    <div className={styles.cell}>
      <p className="t-name">{label}</p>
      {value === undefined ? (
        failed ? (
          <p className={`t-h2 ${styles.cellValue}`}>—</p>
        ) : (
          <Skeleton width="70%" height="var(--fs-h2)" />
        )
      ) : (
        <Money value={value} tone={tone} signed={tone} className={`t-h2 ${styles.cellValue}`} />
      )}
    </div>
  )
}

function StatsPanel({ thisMonth, allTime, failed }: { thisMonth: number | undefined; allTime: number | undefined; failed: boolean }) {
  return (
    <section className={`glass elev-1 ${styles.stats}`} aria-label="Intérêts">
      <StatCell label="Ce mois-ci" value={thisMonth} tone failed={failed} />
      <StatCell label="Depuis toujours" value={allTime} failed={failed} />
    </section>
  )
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const { locale, hidden } = useSettings()
  const pct = goalPercent(goal.current, goal.target)
  const meta = [
    formatWholePercent(pct, locale),
    `${inlineMoney(goal.monthlyContribution, hidden, { locale, compactCents: true })} par mois`,
    `atteint vers ${formatMonthYear(goal.estimatedDate, locale)}`,
  ].join(' · ')
  return (
    <Card to={`/epargne/objectifs/${goal.id}`} className={styles.goal}>
      <span className={styles.goalInner}>
        <span className={styles.goalTop}>
          <span className={styles.goalName}>{goal.name}</span>
          <span className={styles.goalAmount}>
            <Money value={goal.current} compactCents />
            <span className={styles.goalTarget}> / </span>
            <Money value={goal.target} compactCents className={styles.goalTarget} />
          </span>
        </span>
        <ProgressBar value={goalProgress(goal.current, goal.target)} label={`${goal.name} : ${pct} %`} />
        <span className={`t-small ${styles.goalMeta}`}>{meta}</span>
      </span>
    </Card>
  )
}

function GoalsPanel({ goals, loading, error, onRetry, free }: { goals: SavingsGoal[] | undefined; loading: boolean; error: Error | null; onRetry: () => void; free: number | undefined }) {
  const navigate = useNavigate()
  return (
    <section className={styles.section} aria-busy={loading || undefined}>
      <SectionHeader title="Objectifs" action={{ label: 'Nouvel objectif', to: '/epargne/objectifs/nouveau', icon: 'plus', variant: 'circle' }} />
      {loading ? (
        <div className={styles.goals}>
          <Skeleton shape="card" height={92} />
          <Skeleton shape="card" height={92} />
        </div>
      ) : error && !goals ? (
        <ErrorState compact error={error} onRetry={onRetry} />
      ) : goals && goals.length > 0 ? (
        <>
          <div className={styles.goals}>
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
          <p className={styles.free}>
            <span className="t-small t-muted">Non affecté</span>
            {free === undefined ? <Skeleton width={80} height={16} /> : <Money value={free} className={`t-small ${styles.freeValue}`} />}
          </p>
        </>
      ) : (
        <EmptyState
          compact
          message="Aucun objectif pour l’instant. Donnez un nom à ce que vous préparez."
          action={
            <Button variant="secondary" icon={<Icon name="target" size={18} />} onClick={() => navigate('/epargne/objectifs/nouveau')}>
              Créer un objectif
            </Button>
          }
        />
      )}
    </section>
  )
}

export default function SavingsPage() {
  const { hidden, toggleHidden, locale } = useSettings()
  const [range, setRange] = useState<ChartRange>('1Y')
  const [hover, setHover] = useState<PricePoint | null>(null)

  const savings = useSavings()
  const account = useAccount('savings')
  const goals = useGoals()
  const history = useQuery<PriceHistory>(QK.savingsHistory(range), () => api.savings.history(range), { staleTime: 30_000 })
  const activity = useTransactions(IDS.savings)
  const wide = useMediaQuery('(min-width: 768px)')

  const balance = savings.data?.balance ?? account.data?.balance
  const apy = savings.data?.apy ?? account.data?.apy
  const period = RANGES.find((r) => r.value === range)
  const free = unallocated(balance, goals.data)
  const recent = activity.data?.slice(0, RECENT_COUNT)

  const heroValue = hover ? hover.p : balance
  const heroCaption = hover
    ? formatDateTime(hover.t, { locale })
    : savings.data
      ? `Intérêts versés le ${formatDate(savings.data.nextPayoutDate, { locale })}`
      : undefined

  const stats = <StatsPanel thisMonth={savings.data?.interestThisMonth} allTime={savings.data?.interestAllTime} failed={!!savings.error && !savings.data} />
  const goalsPanel = <GoalsPanel goals={goals.data} loading={goals.loading} error={goals.error} onRetry={() => void goals.refetch()} free={free} />

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <AppBar title="Épargne" />

          {/* Balance, curve and period are one statement — one surface. */}
          <Card padding="lg" className={styles.balanceCard}>
            <section className={styles.hero} aria-busy={savings.loading || undefined}>
              <div className={styles.heroTop}>
                <p className="t-name">Solde</p>
                {apy !== undefined ? <Badge tone="accent">{`APY ${formatApy(apy, locale)}`}</Badge> : null}
                <Button variant="ghost" iconOnly aria-label={hidden ? 'Afficher les soldes' : 'Masquer les soldes'} aria-pressed={hidden} onClick={toggleHidden} className={styles.eye}>
                  <Icon name={hidden ? 'eye-off' : 'eye'} size={20} />
                </Button>
              </div>
              {savings.error && balance === undefined ? (
                <ErrorState compact error={savings.error} onRetry={() => void savings.refetch()} />
              ) : (
                <AmountDisplay value={heroValue} caption={heroCaption} />
              )}
            </section>

            <section className={styles.chartBlock} aria-label="Croissance du solde Épargne">
              {history.error && !history.data ? (
                <ErrorState compact className={styles.chartError} error={history.error} onRetry={() => void history.refetch()} />
              ) : (
                <Chart
                  className={styles.chart}
                  points={history.data?.points ?? []}
                  height={wide ? 260 : 200}
                  tone="ink"
                  label={`Solde Épargne, ${period?.period.toLowerCase() ?? range}`}
                  loading={history.loading && !history.data}
                  onHover={setHover}
                  formatValue={(v) => (hidden ? MASKED : formatMoney(v, { locale }))}
                  formatTime={(t) => formatDate(t, { locale })}
                />
              )}
              <SegmentedControl
                segments={RANGES.map((r) => ({ value: r.value, label: r.label }))}
                value={range}
                onChange={setRange}
                label="Période du graphique"
                size="sm"
                bare
              />
            </section>
          </Card>

          <QuickActions
            className={styles.actions}
            actions={[
              { label: 'Déposer', icon: <Icon name="deposit" />, to: '/epargne/deposer' },
              { label: 'Retirer', icon: <Icon name="withdraw" />, to: '/epargne/retirer' },
              { label: 'Créer un objectif', icon: <Icon name="target" />, to: '/epargne/objectifs/nouveau' },
              { label: 'Détails', icon: <Icon name="landmark" />, to: '/carte/details?compte=epargne' },
            ]}
          />

          <div className={styles.asideMobile}>
            {stats}
            {goalsPanel}
          </div>

          <section className={styles.section} aria-busy={activity.loading || undefined}>
            <SectionHeader title="Activité" action={{ label: 'Tout voir', to: '/activite', icon: 'arrow-right' }} />
            {activity.loading ? (
              <SkeletonRow count={RECENT_COUNT} />
            ) : activity.error && !recent ? (
              <ErrorState compact error={activity.error} onRetry={() => void activity.refetch()} />
            ) : recent && recent.length > 0 ? (
              <List>
                {recent.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </List>
            ) : (
              <EmptyState compact message="Aucun mouvement sur ce compte pour l’instant." />
            )}
          </section>
        </div>

        <aside className={styles.aside}>
          {stats}
          {goalsPanel}
        </aside>
      </div>
    </div>
  )
}
