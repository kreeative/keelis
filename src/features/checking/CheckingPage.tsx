/**
 * Chèque — the available balance is the hero; the virtual card, its freeze switch and the
 * account shortcuts sit beside the transaction list on wide screens (sticky side column).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IDS } from '@/api'
import type { Transaction } from '@/api/types'
import { AmountDisplay, AppBar, Badge, Button, Card, EmptyState, ErrorState, Field, Icon, List, QuickActions, Refreshing, SkeletonRow } from '@/components'
import { TransactionRow, groupByDay, useAccount, useTransactions } from '@/features/shared'
import { formatDayHeading, formatMoney, formatNumber } from '@/lib/format'
import { useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { CardPanel } from './CardPanel'
import { FilterSheet } from './FilterSheet'
import { EMPTY_FILTER, describeFilter, isEmptyFilter, narrow, toApiFilter, type FilterState } from './filters'
import styles from './CheckingPage.module.css'

const SKELETON_ROWS = 6
const SEARCH_DEBOUNCE = 250
/** Transactions shown before « Afficher plus ». */
const PAGE_SIZE = 25

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function CheckingPage() {
  const navigate = useNavigate()
  const { locale, hidden, toggleHidden } = useSettings()
  const account = useAccount('checking')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE)
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER)
  const [sheetOpen, setSheetOpen] = useState(false)

  const apiFilter = useMemo(() => toApiFilter(filter, debouncedQuery), [filter, debouncedQuery])
  const txs = useTransactions(IDS.checking, apiFilter)

  // Keep the previous page of results on screen while a new filter loads:
  // skeletons are for the very first load only.
  const lastList = useRef<Transaction[] | undefined>(undefined)
  if (txs.data) lastList.current = txs.data
  const list = txs.data ?? lastList.current

  const items = useMemo(() => narrow(list ?? [], filter), [list, filter])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = useMemo(() => items.slice(0, visible), [items, visible])
  const groups = useMemo(() => groupByDay(shown), [shown])
  const remaining = items.length - shown.length
  const activeFilters = useMemo(() => describeFilter(filter, (n) => formatMoney(n, { locale, compactCents: true })), [filter, locale])

  const filterKey = JSON.stringify([filter, debouncedQuery])
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [filterKey])

  const filtering = !isEmptyFilter(filter) || debouncedQuery.trim() !== ''
  const clearAll = () => {
    setFilter(EMPTY_FILTER)
    setQuery('')
  }

  const firstLoad = list === undefined && !txs.error
  const status = list === undefined ? '' : items.length === 0 ? 'Aucune transaction' : `${formatNumber(items.length, { locale })} transaction${items.length > 1 ? 's' : ''}`

  let body
  if (firstLoad) {
    body = <SkeletonRow count={SKELETON_ROWS} />
  } else if (txs.error && !txs.data) {
    body = <ErrorState error={txs.error} onRetry={() => void txs.refetch()} />
  } else if (items.length === 0) {
    body = filtering ? (
      <EmptyState
        compact
        message="Aucune transaction ne correspond à ces critères."
        action={
          <Button variant="secondary" onClick={clearAll}>
            Effacer les filtres
          </Button>
        }
      />
    ) : (
      <EmptyState
        compact
        message="Aucune transaction sur ce compte pour l’instant."
        action={
          <Button variant="secondary" onClick={() => navigate('/fonds')}>
            Ajouter des fonds
          </Button>
        }
      />
    )
  } else {
    body = (
      <>
        {groups.map((group) => (
          <section key={group.day} className={styles.group} aria-label={formatDayHeading(group.date, { locale })}>
            <h3 className={cn('t-label', styles.dayHead)}>{formatDayHeading(group.date, { locale })}</h3>
            <List>
              {group.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} to={`/transactions/${tx.id}`} />
              ))}
            </List>
          </section>
        ))}
        {remaining > 0 ? (
          <div className={styles.more}>
            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Afficher plus
            </Button>
            <p className={styles.remaining}>{`${formatNumber(remaining, { locale })} transaction${remaining > 1 ? 's' : ''} de plus`}</p>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <AppBar title="Chèque" />
      <div className={styles.layout}>
        <Card padding="lg" className={styles.balanceCard}>
          <section className={styles.hero} aria-label="Solde du compte Chèque" aria-busy={account.loading || undefined}>
            <div className={styles.heroTop}>
              <p className="t-name">Disponible</p>
              <Button variant="ghost" iconOnly aria-label={hidden ? 'Afficher les soldes' : 'Masquer les soldes'} aria-pressed={hidden} onClick={toggleHidden} className={styles.eye}>
                <Icon name={hidden ? 'eye-off' : 'eye'} size={20} />
              </Button>
            </div>
            {account.error && !account.data ? (
              <ErrorState compact error={account.error} onRetry={() => void account.refetch()} />
            ) : (
              <AmountDisplay value={account.data?.balance} caption="Disponible maintenant" />
            )}
          </section>
        </Card>

        <aside className={styles.side}>
          <CardPanel />
          <QuickActions
            className={styles.actions}
            actions={[
              { label: 'Ajouter', icon: <Icon name="plus" />, to: '/fonds' },
              { label: 'Envoyer', icon: <Icon name="send" />, to: '/envoyer' },
              { label: 'Virement', icon: <Icon name="transfer" />, to: '/envoyer?mode=interne' },
              { label: 'Détails', icon: <Icon name="landmark" />, to: '/carte/details' },
            ]}
          />
        </aside>

        <section className={styles.transactions} aria-labelledby="checking-tx" aria-busy={firstLoad || undefined}>
          <div className={styles.txHead}>
            <span className={styles.txTitle}>
              <h2 id="checking-tx" className="t-section">
                Transactions
              </h2>
              <Refreshing active={!firstLoad && txs.data === undefined && !txs.error} />
            </span>
            <Button
              variant="secondary"
              iconOnly
              aria-label="Filtrer les transactions"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <Icon name="filter" size={20} />
            </Button>
          </div>

          <Field
            label="Rechercher une transaction"
            hideLabel
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Rechercher un marchand, une note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Icon name="search" size={20} />}
            trailing={
              query ? (
                <Button variant="ghost" iconOnly aria-label="Effacer la recherche" onClick={() => setQuery('')} className={styles.clear}>
                  <Icon name="x" size={20} />
                </Button>
              ) : undefined
            }
            className={styles.search}
          />

          {activeFilters.length ? (
            <div className={styles.activeFilters}>
              {activeFilters.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
              <Button variant="ghost" onClick={() => setFilter(EMPTY_FILTER)} className={styles.clearFilters}>
                Effacer
              </Button>
            </div>
          ) : null}

          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>

          <Card material="solid" padding="md" elevation={1} className={styles.resultsCard}>
            <div className={styles.results}>{body}</div>
          </Card>
        </section>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filter}
        onApply={(next) => {
          setFilter(next)
          setSheetOpen(false)
        }}
      />
    </div>
  )
}
