/**
 * /crypto/:id — live price as the hero, chart mirrored into the hero on hover,
 * holdings, facts, and a sticky Acheter / Vendre bar on mobile.
 */
import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { ChartRange, CryptoAsset, Holding, PriceHistory, PricePoint } from '@/api/types'
import { AmountDisplay, Button, Chart, Delta, ErrorState, Icon, Money, QuickActions, SegmentedControl, Skeleton, SkeletonAmount } from '@/components'
import { MASKED, formatCrypto, formatDateTime } from '@/lib/format'
import { QK, useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import { RANGES, formatCompactMoney, formatCompactQuantity, rangePeriod } from './cryptoFormat'
import { patchQuery, useDesktop, useLiveAsset, useLiveHistory, useLiveHoldings } from './hooks'
import styles from './AssetDetailPage.module.css'

function toneOf(n: number): 'pos' | 'neg' | 'ink' {
  return n > 0 ? 'pos' : n < 0 ? 'neg' : 'ink'
}

function HoldingsSection({ asset, holding, loading }: { asset: CryptoAsset; holding: Holding | undefined; loading: boolean }) {
  const { locale, hidden } = useSettings()
  return (
    <section className={cn(styles.section, styles.holdings)} aria-labelledby="holdings-title">
      <h2 id="holdings-title" className="t-label">
        Vos avoirs
      </h2>
      {loading ? (
        <div className={styles.grid} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} shape="card" height={76} />
          ))}
        </div>
      ) : holding && holding.quantity > 0 ? (
        <dl className={styles.grid}>
          <div className={styles.cell}>
            <dt className="t-label">Quantité</dt>
            <dd className={styles.cellValue}>{hidden ? MASKED : formatCrypto(holding.quantity, asset.symbol, { locale })}</dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-label">Valeur</dt>
            <dd className={styles.cellValue}>
              <Money value={holding.value} />
            </dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-label">Prix moyen</dt>
            <dd className={styles.cellValue}>
              <Money value={holding.avgCost} unmasked />
            </dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-label">Rendement</dt>
            <dd className={cn(styles.cellValue, styles.cellStack)}>
              <Money value={holding.pnl} signed tone />
              <Delta value={holding.pnlPct} className={styles.cellDelta} />
            </dd>
          </div>
        </dl>
      ) : (
        <p className={styles.quiet}>Vous ne détenez pas encore de {asset.name}.</p>
      )}
    </section>
  )
}

function AboutSection({ asset }: { asset: CryptoAsset }) {
  const { locale } = useSettings()
  const facts: Array<[string, string]> = [
    ['Capitalisation', formatCompactMoney(asset.marketCap, locale)],
    ['Volume 24 h', formatCompactMoney(asset.volume24h, locale)],
    ['Offre en circulation', formatCompactQuantity(asset.circulatingSupply, asset.symbol, locale)],
    ['Réseaux', asset.networks.map((n) => n.name).join(', ')],
  ]
  return (
    <section className={cn(styles.section, styles.about)} aria-labelledby="about-title">
      <h2 id="about-title" className="t-label">
        À propos
      </h2>
      <p className={styles.description}>{asset.description}</p>
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt className={styles.factLabel}>{label}</dt>
            <dd className={cn(styles.factValue, 'num')}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function AssetDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()
  const desktop = useDesktop()
  const assetQ = useLiveAsset(id)
  const asset = assetQ.data
  const holdings = useLiveHoldings()
  const holding = holdings.data?.find((h) => h.assetId === id)
  const hasHolding = !!holding && holding.quantity > 0

  const [range, setRange] = useState<ChartRange>('1D')
  const history = useLiveHistory(id, range)
  // Keep the last loaded range on screen while the next one loads.
  const [shown, setShown] = useState<PriceHistory | undefined>(undefined)
  if (history.data && history.data !== shown) setShown(history.data)
  const chartHistory = history.data ?? (shown && shown.assetId === id ? shown : undefined)

  const [hover, setHover] = useState<PricePoint | null>(null)
  const onHover = useCallback((p: PricePoint | null) => setHover(p), [])

  const [watchPending, setWatchPending] = useState(false)
  const toggleWatch = async () => {
    if (!asset || watchPending) return
    const next = !asset.watched
    const patch = (a: CryptoAsset | undefined) => (a ? { ...a, watched: next } : a!)
    setWatchPending(true)
    patchQuery<CryptoAsset>(QK.asset(id), patch)
    patchQuery<CryptoAsset[]>(QK.assets, (list) => (list ?? []).map((a) => (a.id === id ? { ...a, watched: next } : a)))
    try {
      await api.crypto.setWatched(id, next)
      toast(next ? 'Ajouté aux suivis' : 'Retiré des suivis')
    } catch (err) {
      patchQuery<CryptoAsset>(QK.asset(id), (a) => (a ? { ...a, watched: !next } : a!))
      patchQuery<CryptoAsset[]>(QK.assets, (list) => (list ?? []).map((a) => (a.id === id ? { ...a, watched: !next } : a)))
      toast(err instanceof Error ? err.message : 'Impossible de modifier les suivis', 'error')
    } finally {
      setWatchPending(false)
    }
  }

  if (!asset) {
    return (
      <div className={cn('page', styles.page)}>
        <header className={styles.topbar}>
          <Button variant="ghost" iconOnly aria-label="Retour" onClick={() => navigate('/crypto')} className={styles.back}>
            <Icon name="arrow-left" />
          </Button>
        </header>
        {assetQ.error ? (
          <ErrorState error={assetQ.error} onRetry={() => void assetQ.refetch()} />
        ) : (
          <div className={styles.hero} aria-busy="true">
            <SkeletonAmount />
            <Chart points={[]} loading height={desktop ? 280 : 220} label="Chargement du graphique" className={styles.chart} />
          </div>
        )}
      </div>
    )
  }

  const first = chartHistory?.points[0]?.p
  const heroValue = hover ? hover.p : asset.price
  const delta = chartHistory ? (hover && first !== undefined ? hover.p - first : chartHistory.change) : undefined
  const deltaPct = chartHistory ? (hover && first !== undefined && first > 0 ? ((hover.p - first) / first) * 100 : chartHistory.changePct) : undefined
  const caption = hover ? formatDateTime(hover.t, { locale }) : asset.name
  const chartTone = chartHistory ? toneOf(chartHistory.changePct) : 'ink'

  return (
    <div className={cn('page', styles.page)}>
      <header className={styles.topbar}>
        <Button variant="ghost" iconOnly aria-label="Retour" onClick={() => navigate('/crypto')} className={styles.back}>
          <Icon name="arrow-left" />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          aria-label={asset.watched ? 'Retirer des suivis' : 'Ajouter aux suivis'}
          aria-pressed={asset.watched}
          onClick={() => void toggleWatch()}
          className={cn(styles.star, asset.watched && styles.starOn)}
        >
          <Icon name="star" fill={asset.watched ? 'currentColor' : 'none'} />
        </Button>
      </header>

      <section className={styles.hero} aria-label={`Prix de ${asset.name}`}>
        <h1 className="t-label">{asset.symbol}</h1>
        <AmountDisplay value={heroValue} delta={delta} deltaPct={deltaPct} period={delta !== undefined ? rangePeriod(range) : undefined} caption={caption} unmasked />
      </section>

      <div className={styles.chartBlock}>
        <Chart
          points={chartHistory?.points ?? []}
          loading={!chartHistory}
          height={desktop ? 280 : 220}
          tone={chartTone}
          onHover={onHover}
          label={`Évolution du prix de ${asset.name} sur ${rangePeriod(range)}`}
          className={styles.chart}
        />
        <SegmentedControl segments={RANGES} value={range} onChange={setRange} label="Période du graphique" block className={styles.tabs} />
      </div>

      <div className={styles.actions}>
        <QuickActions
          actions={[
            { label: 'Envoyer', icon: <Icon name="send" />, to: `/crypto/${id}/envoyer`, disabled: holdings.data !== undefined && !hasHolding },
            { label: 'Recevoir', icon: <Icon name="deposit" />, to: `/crypto/${id}/recevoir` },
            { label: 'Récurrent', icon: <Icon name="recurring" />, to: '/crypto/recurrents' },
          ]}
        />
      </div>

      <HoldingsSection asset={asset} holding={holding} loading={holdings.data === undefined && holdings.loading} />
      <AboutSection asset={asset} />

      <div className={styles.bar}>
        <Button size="lg" block onClick={() => navigate(`/crypto/${id}/acheter`)}>
          Acheter
        </Button>
        <Button size="lg" block variant="secondary" disabled={!hasHolding} onClick={() => navigate(`/crypto/${id}/vendre`)}>
          Vendre
        </Button>
      </div>
    </div>
  )
}
