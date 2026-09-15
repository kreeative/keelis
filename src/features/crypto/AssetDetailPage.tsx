/**
 * /crypto/:id — live price as the hero, chart mirrored into the hero on hover,
 * holdings, facts, and a sticky Acheter / Vendre bar on mobile.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { ChartRange, CryptoAsset, Holding, PriceHistory, PricePoint } from '@/api/types'
import type { Stat } from '@/components'
import { AmountDisplay, Button, CandleChart, Chart, Delta, ErrorState, Icon, Money, QuickActions, SegmentedControl, Skeleton, SkeletonAmount, StatGrid } from '@/components'
import { MASKED, formatCrypto, formatDate, formatDateTime, formatTime, moneyAriaLabel, splitMoney } from '@/lib/format'
import { QK, useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import { RANGES, formatCompactMoney, formatCompactQuantity, rangePeriod } from './cryptoFormat'
import { patchQuery, useDesktop, useLiveAsset, useLiveHistory, useLiveHoldings } from './hooks'
import { useLargeScreen } from '@/store'
import { LearnSheet } from './LearnSheet'
import styles from './AssetDetailPage.module.css'

function toneOf(n: number): 'pos' | 'neg' | 'ink' {
  return n > 0 ? 'pos' : n < 0 ? 'neg' : 'ink'
}

function HoldingsSection({ asset, holding, loading }: { asset: CryptoAsset; holding: Holding | undefined; loading: boolean }) {
  const { locale, hidden } = useSettings()
  return (
    <section className={cn(styles.section, styles.holdings)} aria-labelledby="holdings-title">
      <h2 id="holdings-title" className="t-section">
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
            <dt className="t-name">Quantité</dt>
            <dd className={styles.cellValue}>{hidden ? MASKED : formatCrypto(holding.quantity, asset.symbol, { locale })}</dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-name">Valeur</dt>
            <dd className={styles.cellValue}>
              <Money value={holding.value} />
            </dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-name">Prix moyen</dt>
            <dd className={styles.cellValue}>
              <Money value={holding.avgCost} unmasked />
            </dd>
          </div>
          <div className={styles.cell}>
            <dt className="t-name">Rendement</dt>
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

function AboutSection({ asset, onLearn }: { asset: CryptoAsset; onLearn: () => void }) {
  const { locale } = useSettings()
  const facts: Stat[] = [
    { label: 'Capitalisation', value: formatCompactMoney(asset.marketCap, locale) },
    { label: 'Volume 24 h', value: formatCompactMoney(asset.volume24h, locale) },
    { label: asset.assetClass === 'equity' ? 'Titres en circulation' : 'Offre en circulation', value: formatCompactQuantity(asset.circulatingSupply, asset.symbol, locale) },
    // A share does not settle on a chain, so it has no networks — and the row used to
    // render anyway, as a heading with nothing under it.
    ...(asset.networks.length > 0 ? [{ label: 'Réseaux', value: asset.networks.map((n) => n.name).join(', ') }] : []),
    ...(asset.assetClass === 'equity' && asset.market ? [{ label: 'Place de cotation', value: asset.market }] : []),
  ]
  return (
    <section className={cn(styles.section, styles.about)} aria-labelledby="about-title">
      <h2 id="about-title" className="t-section">
        À propos
      </h2>
      <p className={styles.description}>{asset.description}</p>
      <StatGrid stats={facts} label={`Données de marché — ${asset.name}`} className={styles.facts} />
      {/* Most people buying their first share on the BRVM have never bought one anywhere;
          the words on this screen are what stops them, not the buttons. */}
      <Button variant="ghost" icon={<Icon name="help-circle" size={18} />} onClick={onLearn} className={styles.learn}>
        Comment lire un cours
      </Button>
    </section>
  )
}

export default function AssetDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()
  const desktop = useDesktop()
  // The pro view is offered from 1024px only: a candle packs four numbers into one mark,
  // and below a laptop there is neither the width to separate the bodies nor a pointer
  // precise enough to read them. The phone keeps the line, which is the right chart there.
  const pro = useLargeScreen()
  const [advanced, setAdvanced] = useState(false)
  const assetQ = useLiveAsset(id)
  const asset = assetQ.data
  const holdings = useLiveHoldings()
  const holding = holdings.data?.find((h) => h.assetId === id)
  const hasHolding = !!holding && holding.quantity > 0
  // An asset that settles on a chain. Equities do not, and `networks` is empty for them.
  const onChain = (asset?.networks.length ?? 0) > 0
  const [learn, setLearn] = useState(false)

  const [range, setRange] = useState<ChartRange>('1D')
  const history = useLiveHistory(id, range)
  // Keep the last loaded range on screen while the next one loads.
  const [shown, setShown] = useState<PriceHistory | undefined>(undefined)
  if (history.data && history.data !== shown) setShown(history.data)
  const chartHistory = history.data ?? (shown && shown.assetId === id ? shown : undefined)

  /* Above the `if (!asset)` below, and that is not tidiness: a hook after an early return
     runs on some renders and not others, and React counts them. Put here first, the asset
     page threw #310 — « rendered more hooks than during the previous render » — on its very
     first paint, when `asset` is still undefined. `RouteBoundary` caught it, which is why
     the screen said « Impossible de charger » instead of going white.

     One pass over the very points the chart draws. Not `useMemo` for speed — a thousand
     points is nothing — but so the four figures are computed from one array in one place
     and cannot drift from the curve the way a second query would. */
  const ohlc = useMemo(() => {
    const pts = chartHistory?.points
    if (!pts || pts.length < 2) return null
    let lo = Infinity
    let hi = -Infinity
    for (const pt of pts) {
      if (pt.p < lo) lo = pt.p
      if (pt.p > hi) hi = pt.p
    }
    /* The digits without the symbol, through `splitMoney` — the same tool `moneyPair` uses
       for the side of a pair that does not carry the unit. Four repetitions of « F CFA » on
       one line is twenty-four characters spent saying what the hero says once directly
       above, and the chart's own scale under this row is bare for the same reason. Full
       precision, not the compact form: on a market screen the difference between 92,391,220
       and 92,4 M is the part somebody came to read. */
    const digits = (v: number) => splitMoney(v, { locale }).number
    const full = (v: number) => moneyAriaLabel(v, { locale })
    return [
      { key: 'O', name: 'Ouverture', value: digits(pts[0]!.p), label: full(pts[0]!.p) },
      { key: 'H', name: 'Plus haut', value: digits(hi), label: full(hi) },
      { key: 'B', name: 'Plus bas', value: digits(lo), label: full(lo) },
      { key: 'C', name: 'Clôture', value: digits(pts[pts.length - 1]!.p), label: full(pts[pts.length - 1]!.p) },
    ]
  }, [chartHistory, locale])

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
        <h1 className={styles.topTitle}>{asset.name}</h1>
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
        <p className="t-name">{asset.symbol}</p>
        {/* Not while scrubbing: the hero mirrors the chart under the finger, and a counting
            number cannot keep up with it. */}
        <AmountDisplay value={heroValue} delta={delta} deltaPct={deltaPct} period={delta !== undefined ? rangePeriod(range) : undefined} caption={caption} unmasked animate={!hover} />
        {/* Open, high, low, close for the period on screen — the four numbers the reference
            puts on the same line as the price, and the four a person actually asks for:
            where it started, how far it got either way, where it ended. Every one is read
            off the series the chart is drawing, never a second source, so the row cannot
            disagree with the curve above it.

            Abbreviated, because at 390px « 92,001,332 F CFA » four times is 700px of a
            358px row. The symbol is written once, at the end, for the same reason
            `moneyPair` does: four repetitions of « F CFA » say the unit three times too
            many. */}
        {ohlc ? (
          <dl className={styles.ohlc} aria-label={`Ouverture, plus haut, plus bas et clôture sur ${rangePeriod(range)}`}>
            {ohlc.map((cell) => (
              <div key={cell.key} className={styles.ohlcCell}>
                {/* The letter is a French abbreviation — Ouverture, Haut, Bas, Clôture — and
                    a single letter is not something a screen reader can do anything with,
                    so the word is on the pair and the whole figure with its currency is on
                    the value. The eye gets the letter; the ear gets the sentence. */}
                <dt className={styles.ohlcKey} title={cell.name}>
                  <abbr title={cell.name} className={styles.ohlcAbbr}>
                    {cell.key}
                  </abbr>
                </dt>
                <dd className={styles.ohlcValue} aria-label={`${cell.name} : ${cell.label}`}>
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <div className={styles.chartBlock}>
        {pro && advanced ? (
          <CandleChart
            points={chartHistory?.points ?? []}
            loading={!chartHistory}
            height={320}
            label={`Chandeliers du prix de ${asset.name} sur ${rangePeriod(range)}`}
            className={styles.chart}
          />
        ) : (
          <Chart
            points={chartHistory?.points ?? []}
            loading={!chartHistory}
            height={desktop ? 280 : 220}
            tone={chartTone}
            onHover={onHover}
            label={`Évolution du prix de ${asset.name} sur ${rangePeriod(range)}`}
            /* The scale belongs on a market screen and not on the home hero: here the levels
               *are* the question — how near the top of the day this is, how far the drop
               went, where the price has been sitting — while on Accueil the figure is
               printed directly above the curve and the scrub swaps into it. */
            axes
            /* A day is read in hours and anything longer in days. `formatDateTime` gives
               « 10 sept. 2026, 14:32 », which is four labels' worth of width for one. */
            formatAxisTime={(t) => (range === '1D' ? formatTime(t, { locale }) : formatDate(t, { locale, style: 'short' }))}
            className={styles.chart}
          />
        )}
        <div className={styles.chartControls}>
          <SegmentedControl segments={RANGES} value={range} onChange={setRange} label="Période du graphique" bare className={styles.tabs} />
          {pro ? (
            <Button
              variant="secondary"
              aria-pressed={advanced}
              onClick={() => setAdvanced((v) => !v)}
              icon={<Icon name={advanced ? 'chart-line' : 'chart-candle'} size={18} />}
              className={styles.proToggle}
            >
              {advanced ? 'Vue ligne' : 'Vue avancée'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.actions}>
        {/* Sending and receiving are chain operations. A share of Sonatel cannot be sent to
            an address, and offering the action on an equity is a promise the page cannot
            keep — the receive screen would have had no network to show. */}
        <QuickActions
          actions={
            onChain
              ? [
                  { label: 'Envoyer', icon: <Icon name="send" />, to: `/crypto/${id}/envoyer`, disabled: holdings.data !== undefined && !hasHolding },
                  { label: 'Recevoir', icon: <Icon name="deposit" />, to: `/crypto/${id}/recevoir` },
                  { label: 'Récurrent', icon: <Icon name="recurring" />, to: '/crypto/recurrents' },
                ]
              : [{ label: 'Récurrent', icon: <Icon name="recurring" />, to: '/crypto/recurrents' }]
          }
        />
      </div>

      <HoldingsSection asset={asset} holding={holding} loading={holdings.data === undefined && holdings.loading} />
      <AboutSection asset={asset} onLearn={() => setLearn(true)} />

      <div className={styles.bar}>
        <Button size="lg" block onClick={() => navigate(`/crypto/${id}/acheter`)}>
          Acheter
        </Button>
        <Button size="lg" block variant="secondary" disabled={!hasHolding} onClick={() => navigate(`/crypto/${id}/vendre`)}>
          Vendre
        </Button>
      </div>
          {learn ? <LearnSheet topic="cours" open onClose={() => setLearn(false)} /> : null}
</div>
  )
}
