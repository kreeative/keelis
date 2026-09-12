/**
 * /crypto — the Crypto account value is the hero; under it, live prices for every asset.
 * Prices come from useMarket() (tick every 10 s) and update in place, without animation.
 */
import { useDeferredValue, useMemo, useState } from 'react'
import { AmountDisplay, AppBar, AssetIcon, Badge, Button, Card, Chart, ChipBar, Delta, EmptyState, ErrorState, Field, Icon, List, ListRow, Money, SegmentedControl, SkeletonRow, Sparkline } from '@/components'
import { api } from '@/api'
import type { ChartRange, CryptoAsset, Holding, PriceHistory } from '@/api/types'
import { MASKED, formatCrypto, formatMoney } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { RANGES, monthlyTotal, rangePeriod } from './cryptoFormat'
import { useLiveAccount, useLiveAssets, useLiveHoldings, useLiveRecurring } from './hooks'
import styles from './CryptoListPage.module.css'

type Filter = 'all' | 'equity' | 'crypto' | 'mine' | 'watched' | 'gainers' | 'losers'

/* A scrolling chip bar holds more ways to cut the list than three fixed segments could.
   Actions africaines leads, because that is what the app is for. */
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'equity', label: 'Actions africaines' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'mine', label: 'Mes actifs' },
  { value: 'watched', label: 'Suivis' },
  { value: 'gainers', label: 'Plus fortes hausses' },
  { value: 'losers', label: 'Plus fortes baisses' },
]

function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function AssetRow({ asset, holding }: { asset: CryptoAsset; holding: Holding | undefined }) {
  const { locale, hidden } = useSettings()
  const held = holding && holding.quantity > 0
  const where = asset.assetClass === 'equity' ? `${asset.name} · ${asset.market}` : asset.name
  const subtitle = held ? `${where} · ${hidden ? MASKED : formatCrypto(holding.quantity, undefined, { locale })} ${asset.symbol}` : where
  return (
    <ListRow
      to={`/crypto/${asset.id}`}
      leading={<AssetIcon symbol={asset.symbol} label={asset.name} />}
      title={asset.symbol}
      subtitle={subtitle}
      value={
        <span className={styles.valueLine}>
          <span className={styles.spark}>
            <Sparkline values={asset.sparkline} width={64} height={20} />
          </span>
          <Money value={asset.price} unmasked />
        </span>
      }
      valueSub={<Delta value={asset.change24hPct} amount={asset.change24h} />}
    />
  )
}

export default function CryptoListPage() {
  const { locale } = useSettings()
  const market = useLiveAssets()
  const account = useLiveAccount('crypto')
  const [bookRange, setBookRange] = useState<ChartRange>('1M')
  const bookHistory = useQuery<PriceHistory>(QK.cryptoPortfolioHistory(bookRange), () => api.crypto.portfolioHistory(bookRange), { staleTime: 30_000 })
  const holdings = useLiveHoldings()
  const recurring = useLiveRecurring()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const holdingById = useMemo(() => {
    const m = new Map<string, Holding>()
    for (const h of holdings.data ?? []) m.set(h.assetId, h)
    return m
  }, [holdings.data])

  const rows = useMemo(() => {
    const assets = market.assets ?? []
    const q = normalise(deferredQuery)
    let list = assets.filter((a) => (q ? normalise(a.name).includes(q) || normalise(a.symbol).includes(q) : true))
    if (filter === 'equity' || filter === 'crypto') {
      list = list.filter((a) => a.assetClass === filter).sort((a, b) => a.rank - b.rank)
    } else if (filter === 'mine') {
      list = list.filter((a) => (holdingById.get(a.id)?.quantity ?? 0) > 0).sort((a, b) => (holdingById.get(b.id)?.value ?? 0) - (holdingById.get(a.id)?.value ?? 0))
    } else if (filter === 'gainers') {
      list = list.slice().sort((a, b) => b.change24hPct - a.change24hPct)
    } else if (filter === 'losers') {
      list = list.slice().sort((a, b) => a.change24hPct - b.change24hPct)
    } else {
      if (filter === 'watched') list = list.filter((a) => a.watched)
      list = list.slice().sort((a, b) => a.rank - b.rank)
    }
    return list
  }, [market.assets, deferredQuery, filter, holdingById])

  const activeRecurring = (recurring.data ?? []).filter((r) => r.active)
  const recurringSubtitle =
    recurring.data === undefined
      ? 'Automatisez vos achats'
      : activeRecurring.length === 0
        ? 'Aucun achat programmé'
        : `${activeRecurring.length} ${activeRecurring.length > 1 ? 'achats actifs' : 'achat actif'} · ${formatMoney(monthlyTotal(recurring.data), { locale })} par mois`

  const firstLoad = (market.assets === undefined && market.loading) || (filter === 'mine' && holdings.data === undefined && holdings.loading)
  const marketFailed = market.assets === undefined && !!market.error

  return (
    <div className={cn('page', styles.page)}>
      <AppBar title="Actifs" />
      <Card padding="lg" className={styles.heroCard}>
        <section className={styles.hero} aria-label="Solde du compte Crypto">
          <p className="t-name">Valeur du portefeuille</p>
          {account.error && account.data === undefined ? (
            <ErrorState error={account.error} onRetry={() => void account.refetch()} compact />
          ) : (
            <AmountDisplay value={account.data?.balance} delta={account.data?.change24h} deltaPct={account.data?.change24hPct} period="24 h" loading={account.data === undefined} />
          )}
          {/* This section's own curve. The one on Accueil summarises the whole wealth; this
              one is the book alone, computed from the holdings' real series so the two
              cannot disagree about what they are drawing. */}
          <div className={styles.bookChart}>
            <Chart
              points={bookHistory.data?.points ?? []}
              loading={bookHistory.loading && !bookHistory.data}
              height={140}
              label={`Valeur du portefeuille crypto sur ${rangePeriod(bookRange)}`}
            />
            <SegmentedControl segments={RANGES} value={bookRange} onChange={setBookRange} label="Période du portefeuille" size="sm" bare />
          </div>
        </section>
      </Card>

      {/* A market nobody has explained is a market nobody buys into. The demo carries one
          real, dated event so the education has something concrete to hang on. */}
      <Card padding="lg" elevation={1} className={styles.ipoCard}>
        <Badge tone="neutral" icon>
          Bientôt en bourse
        </Badge>
        <h2 className={`t-h2 ${styles.ipoTitle}`}>Dangote Refinery entre à la NGX</h2>
        <p className={styles.ipoBody}>
          La raffinerie de Lekki — la plus grande d’Afrique — ouvre son capital le 14 octobre. Une introduction en bourse
          met des parts d’une entreprise en vente pour la première fois&nbsp;; le prix d’ouverture est fixé à l’avance,
          puis le marché décide. Rien à faire pour l’instant.
        </p>
        <Button variant="secondary" icon={<Icon name="file-text" size={18} />} className={styles.ipoAction}>
          Comprendre une IPO
        </Button>
      </Card>

      <Card padding="none" elevation={1} className={styles.recurringCard}>
        <List className={styles.recurring}>
            <ListRow
            to="/crypto/recurrents"
            leading={
              <span className={styles.recurringIcon} aria-hidden="true">
                <Icon name="recurring" size={20} />
              </span>
            }
            title="Achats récurrents"
            subtitle={recurringSubtitle}
            chevron
          />
        </List>
      </Card>

      <div className={styles.controls}>
        <Field
          label="Rechercher un actif"
          hideLabel
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Rechercher un actif"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Icon name="search" size={20} />}
        />
        <ChipBar chips={FILTERS} value={filter} onChange={setFilter} label="Filtrer les actifs" />
      </div>

      <Card padding="md" elevation={1} className={styles.listCard}>
        <section className={styles.listSection} aria-label="Actifs" aria-busy={firstLoad || undefined}>
          {firstLoad ? (
            <SkeletonRow count={6} />
          ) : marketFailed ? (
            <ErrorState error={market.error} onRetry={() => void market.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState message="Aucun actif ne correspond." compact />
          ) : (
            <List label="Actifs">
              {rows.map((a) => (
                <AssetRow key={a.id} asset={a} holding={holdingById.get(a.id)} />
              ))}
            </List>
          )}
        </section>
      </Card>
    </div>
  )
}
