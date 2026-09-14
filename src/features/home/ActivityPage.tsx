/**
 * Activité — every transaction across accounts, grouped by day.
 * Filters: free-text search (merchant / note), direction (Tous / Entrées / Sorties),
 * and an optional account filter carried in the URL (?compte=cheque|epargne|crypto).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { AccountKind, Transaction } from '@/api/types'
import { Button, Card, ChipBar, EmptyState, ErrorState, Field, Icon, List, Money, PageHeader, SkeletonRow } from '@/components'
import { TransactionRow, groupByDay, isIncoming, useAccounts, useTransactions } from '@/features/shared'
import { formatDayHeading, formatNumber } from '@/lib/format'
import { useSettings } from '@/store'
import styles from './ActivityPage.module.css'

type Direction = 'all' | 'in' | 'out'
type AccountParam = 'cheque' | 'epargne' | 'crypto'

const DIRECTIONS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'in', label: 'Entrées' },
  { value: 'out', label: 'Sorties' },
]

/* The chip says which kind of account; the id it filters on comes from the accounts list. */
const ACCOUNTS: ReadonlyArray<{ value: AccountParam; label: string; kind: AccountKind }> = [
  { value: 'cheque', label: 'Chèque', kind: 'checking' },
  { value: 'epargne', label: 'Épargne', kind: 'savings' },
  { value: 'crypto', label: 'Crypto', kind: 'crypto' },
]

const PARAM = 'compte'
const SKELETON_ROWS = 8

/** Accent- and case-insensitive comparison key. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matches(t: Transaction, q: string): boolean {
  if (!q) return true
  return fold(t.counterparty).includes(q) || (t.note !== undefined && fold(t.note).includes(q))
}

export default function ActivityPage() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const [params, setParams] = useSearchParams()
  const accounts = useAccounts()
  const chosen = ACCOUNTS.find((a) => a.value === params.get(PARAM))
  const accountId = chosen ? accounts.data?.find((a) => a.kind === chosen.kind)?.id : undefined
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<Direction>('all')
  const txs = useTransactions('all')

  const selectAccount = (value: AccountParam | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(PARAM, value)
        else next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }

  const filtered = useMemo(() => {
    const list = txs.data ?? []
    const q = fold(query.trim())
    return list.filter((t) => (!accountId || t.accountId === accountId) && (direction === 'all' || (direction === 'in') === isIncoming(t)) && matches(t, q))
  }, [txs.data, accountId, direction, query])

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  const clearFilters = () => {
    setQuery('')
    setDirection('all')
    selectAccount(null)
  }

  const hasData = txs.data !== undefined
  const status = !hasData ? '' : filtered.length === 0 ? 'Aucune transaction' : `${formatNumber(filtered.length, { locale })} transaction${filtered.length > 1 ? 's' : ''}`

  let body
  if (txs.loading) {
    body = <SkeletonRow count={SKELETON_ROWS} />
  } else if (txs.error && !hasData) {
    body = <ErrorState error={txs.error} onRetry={() => void txs.refetch()} />
  } else if (txs.data && txs.data.length === 0) {
    body = (
      <EmptyState
        message="Aucune transaction pour l'instant."
        action={
          <Button variant="secondary" onClick={() => navigate('/fonds')}>
            Ajouter des fonds
          </Button>
        }
      />
    )
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        compact
        message="Aucune transaction ne correspond."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Effacer les filtres
          </Button>
        }
      />
    )
  } else {
    body = groups.map((g) => {
      const total = g.items.reduce((s, t) => s + t.amount, 0)
      return (
        <section key={g.day} className={styles.group} aria-label={formatDayHeading(g.date, { locale })}>
          <div className={styles.dayHead}>
            <h2 className="t-section">{formatDayHeading(g.date, { locale })}</h2>
            <Money value={total} signed className={styles.dayTotal} />
          </div>
          <List>
            {g.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </List>
        </section>
      )
    })
  }

  return (
    <div className="page">
      <PageHeader back="/" title="Activité" />

      <div className={styles.toolbar}>
        <Field
          label="Rechercher"
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
        {/* One control, not two: a segmented track and a row of loose pills side by side
            were two systems doing the same job. */}
        <ChipBar
          label="Filtrer l’activité"
          value={chosen ? `compte:${chosen.value}` : `sens:${direction}`}
          onChange={(v) => {
            const [kind, val] = v.split(':')
            if (kind === 'sens') {
              selectAccount(null)
              setDirection(val as Direction)
            } else {
              setDirection('all')
              selectAccount(val as AccountParam)
            }
          }}
          chips={[
            ...DIRECTIONS.map((d) => ({ value: `sens:${d.value}`, label: d.label })),
            ...ACCOUNTS.map((a) => ({ value: `compte:${a.value}`, label: a.label })),
          ]}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <Card material="solid" padding="md" elevation={1} className={styles.resultsCard}>
        <div className={styles.results} aria-busy={txs.loading || undefined}>
          {body}
        </div>
      </Card>
    </div>
  )
}
