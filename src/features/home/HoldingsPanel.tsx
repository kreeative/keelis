/**
 * Right-hand panel of the dashboard: Avoirs (crypto positions) / Suivis (watchlist).
 * Live prices, cached values kept during a refetch.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { CryptoAsset, Holding } from '@/api/types'
import { Avatar, Delta, EmptyState, List, ListRow, Money, SegmentedControl, SkeletonRow } from '@/components'
import { formatCrypto } from '@/lib/format'
import { QK, useMarket, useQuery, useSettings } from '@/store'
import styles from './HoldingsPanel.module.css'

type Tab = 'holdings' | 'watchlist'

const TABS = [
  { value: 'holdings' as const, label: 'Avoirs' },
  { value: 'watchlist' as const, label: 'Suivis' },
]

export function HoldingsPanel() {
  const [tab, setTab] = useState<Tab>('holdings')
  const { locale } = useSettings()
  const market = useMarket()
  const holdings = useQuery<Holding[]>(QK.holdings, () => api.crypto.holdings())
  const assets = market.assets

  const watched: CryptoAsset[] = assets?.filter((a) => a.watched) ?? []
  const loading = tab === 'holdings' ? holdings.loading && !holdings.data : market.loading && !assets

  return (
    <section className={styles.panel} aria-label="Portefeuille crypto">
      <SegmentedControl segments={TABS} value={tab} onChange={setTab} label="Vue du portefeuille" size="sm" />
      <div className={styles.body}>
        {loading ? (
          <SkeletonRow count={4} />
        ) : tab === 'holdings' ? (
          holdings.data && holdings.data.length > 0 ? (
            <List>
              {holdings.data.map((h) => (
                <ListRow
                  key={h.assetId}
                  to={`/crypto/${h.assetId}`}
                  leading={<Avatar label={h.symbol} monogram={h.symbol.slice(0, 3)} />}
                  title={assets?.find((a) => a.id === h.assetId)?.name ?? h.symbol}
                  subtitle={formatCrypto(h.quantity, h.symbol, { locale })}
                  value={<Money value={h.value} />}
                  valueSub={<Delta value={h.pnlPct} />}
                />
              ))}
            </List>
          ) : (
            <EmptyState compact message="Vous ne détenez aucune crypto pour l’instant." />
          )
        ) : watched.length > 0 ? (
          <List>
            {watched.map((a) => (
              <ListRow
                key={a.id}
                to={`/crypto/${a.id}`}
                leading={<Avatar label={a.symbol} monogram={a.symbol.slice(0, 3)} />}
                title={a.name}
                subtitle={a.symbol}
                value={<Money value={a.price} />}
                valueSub={<Delta value={a.change24hPct} />}
              />
            ))}
          </List>
        ) : (
          <EmptyState compact message="Suivez un actif pour le retrouver ici." />
        )}
      </div>
      <Link to="/crypto" className={styles.more}>
        Voir tous les actifs
      </Link>
    </section>
  )
}
