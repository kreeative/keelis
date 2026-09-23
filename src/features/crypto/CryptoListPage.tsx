/**
 * /crypto — the whole book's value is the hero; under it, live prices for every asset.
 * Prices come from useMarket() (tick every 10 s) and update in place, without animation.
 *
 * « Actifs » and « Crypto » are two accounts now, and this page still lists both classes —
 * so the hero is their sum (`useLiveBook`) rather than either one, and `?classe=` opens the
 * list on one of them.
 */
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AmountDisplay, AppBar, AssetIcon, Badge, Button, Card, Chart, ChipBar, Delta, EmptyState, ErrorState, Field, Icon, List, ListRow, Money, SegmentedControl, SkeletonRow, Sparkline } from '@/components'
import { api } from '@/api'
import type { ChartRange, CryptoAsset, Holding, PriceHistory } from '@/api/types'
import { MASKED, formatCrypto, formatMoney } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { RANGES, monthlyTotal, rangePeriod } from './cryptoFormat'
import { LearnSheet, type LearnTopic } from './LearnSheet'
import { useLiveAssets, useLiveBook, useLiveHoldings, useLiveRecurring } from './hooks'
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
  /* Two facts on a phone, three from 768px — rather than three always and a truncation.
     A held equity wanted « Dangote Cement · NGX · 9,000 DANGCEM »: 274px of subtitle in the
     154 a 390px row can give it, so the tail was always cut, and the tail is the quantity —
     the one fact on the row that belongs to the reader rather than to the market. Dropping
     the venue below 768px is the cheapest thing to lose: it is reference data, identical on
     every visit, and it is on the asset's own page. The name disambiguates the ticker, the
     quantity says this holding is yours, and the market returns as soon as there is room.
     It is done in CSS rather than with a breakpoint hook so there is no second render and
     nothing to get out of step with the layout. */
  const market = asset.assetClass === 'equity' ? asset.market : null
  /* The quantity carries no unit, because the row's title *is* the unit: « DANGCEM » sat at
     the head of the row and again at the end of its own subtitle, and that repetition was
     85px of the width the line did not have. */
  const quantity = held ? (hidden ? MASKED : formatCrypto(holding.quantity, undefined, { locale })) : null
  /* The *name* takes the ellipsis, not the tail. `.value` never shrinks, so all the pressure
     lands on this line, and a single `text-overflow` on the whole string cuts whatever is
     last — which is the quantity, the one fact here that is the reader's rather than the
     market's. « Dangote Cement · 9,000 » still wants ten more pixels than a 390px row has;
     it now spends them on « Dangote Cem… · 9,000 » instead of « Dangote Cement · 9,… ».
     The name is the disambiguator for a ticker the row has already shown, so it is the part
     that can afford to be shortened. */
  const subtitle = (
    <span className={styles.assetSub}>
      <span className={styles.assetName}>{asset.name}</span>
      {/* A no-break space before the first separator. `.assetSub` is a flex container, so
          each span is a flex item and an ordinary leading space is collapsed as the start of
          its line box — the rows read « Sonatel· 160 ». The separators *inside* the item are
          ordinary spaces, which survive because they are not leading. */}
      <span className={styles.assetFacts}>
        {market ? <span className={held ? styles.venueWide : undefined}>{'\u00a0· '}{market}</span> : null}
        {quantity ? <>{market && !held ? ' · ' : '\u00a0· '}{quantity}</> : null}
      </span>
    </span>
  )
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
  const account = useLiveBook()
  const [bookRange, setBookRange] = useState<ChartRange>('1M')
  const bookHistory = useQuery<PriceHistory>(QK.cryptoPortfolioHistory(bookRange), () => api.crypto.portfolioHistory(bookRange), { staleTime: 30_000 })
  const holdings = useLiveHoldings()
  const recurring = useLiveRecurring()
  /* The chip bar can be opened on a class: « Crypto » is its own account on Accueil now, and
     its card needs somewhere of its own to land rather than the undifferentiated list. Read
     once as the initial state rather than kept in sync with the URL — the chips are a view
     of this page, not a route, and rewriting the address on every tap would put six entries
     in the back stack between here and Accueil. */
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<Filter>(() => {
    const asked = params.get('classe')
    return asked === 'crypto' || asked === 'equity' ? asked : 'all'
  })
  // Which explanation is open, if any — see LearnSheet.
  const [learn, setLearn] = useState<LearnTopic | null>(null)
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
        : /* The amount and its period, and not the count.
             « 2 achats actifs · 158,250 F CFA par mois » wants 261px and the row gives it
             170 at 320px and 240 at 390 — so it was cut at both widths, and what the cut
             took was « par mois »: the amount was left standing next to nothing saying how
             often. The count is the first thing /crypto/recurrents says when you arrive;
             the rate is the fact this row exists to carry. */
          `${formatMoney(monthlyTotal(recurring.data), { locale })} par mois`

  const searching = query.trim().length > 0
  const firstLoad = (market.assets === undefined && market.loading) || (filter === 'mine' && holdings.data === undefined && holdings.loading)
  const marketFailed = market.assets === undefined && !!market.error

  return (
    <div className={cn('page', styles.page)}>
      <AppBar title="Actifs" />
      {/* **The search is the first thing on the screen, because the tab is a magnifier.** It
          sat under the book's chart, the IPO card and the recurring row — a search box on
          the second screen of a tab whose icon promises one. And while somebody types, the
          three cards above the list step aside: results that land below the fold are
          results nobody sees, and a portfolio curve is not what a person spelling
          « Sonatel » is looking at. Clearing the field brings the page back. */}
      <div className={styles.search}>
        <Field
          label="Rechercher un actif"
          hideLabel
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Rechercher une action, une crypto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Icon name="search" size={20} />}
        />
      </div>
      {searching ? null : (
        <>
      <Card padding="lg" className={styles.heroCard}>
        <section className={styles.hero} aria-label="Solde du compte Crypto">
          <p className="t-name">Valeur du portefeuille</p>
          {account.error && account.data === undefined ? (
            <ErrorState error={account.error} onRetry={() => void account.refetch()} compact />
          ) : (
            <AmountDisplay value={account.data?.balance} delta={account.data?.change24h} deltaPct={account.data?.change24hPct} period="24 h" loading={account.data === undefined} animate />
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
        {/* This used to be a button with neither an onClick nor a `to`: it explained
            nothing and did nothing. */}
        <Button variant="secondary" icon={<Icon name="file-text" size={18} />} className={styles.ipoAction} onClick={() => setLearn('ipo')}>
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

        </>
      )}

      <div className={styles.controls}>
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

      {learn ? <LearnSheet topic={learn} open onClose={() => setLearn(null)} /> : null}
    </div>
  )
}
