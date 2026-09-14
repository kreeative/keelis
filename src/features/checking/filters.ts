/**
 * Transaction filtering model for the Chèque screen.
 *
 * The API only ANDs its criteria, so each chip declares the transaction types it can
 * possibly match (sent to `api.transactions.list` as a superset pre-filter) plus a
 * predicate used to narrow the result to the exact union of the selected chips.
 */
import type { Transaction, TransactionFilter, TransactionType } from '@/api/types'

export type PeriodValue = '7' | '30' | '90' | 'all'

export interface TypeChip {
  value: string
  label: string
  /** Types sent to the API (superset of what `match` accepts). */
  types: TransactionType[]
  match: (t: Transaction) => boolean
}

const TRANSFER_TYPES: TransactionType[] = ['transfer_in', 'transfer_out']

export const TYPE_CHIPS: readonly TypeChip[] = [
  { value: 'card', label: 'Carte', types: ['card'], match: (t) => t.type === 'card' },
  {
    value: 'transfers',
    label: 'Virements',
    types: TRANSFER_TYPES,
    match: (t) => TRANSFER_TYPES.includes(t.type) && t.category !== 'savings' && t.category !== 'crypto',
  },
  { value: 'etransfer', label: 'Transferts', types: ['etransfer_in', 'etransfer_out'], match: (t) => t.type === 'etransfer_in' || t.type === 'etransfer_out' },
  { value: 'deposits', label: 'Dépôts', types: ['deposit'], match: (t) => t.type === 'deposit' },
  {
    value: 'savings',
    label: 'Épargne',
    types: ['transfer_in', 'transfer_out', 'deposit', 'withdrawal'],
    match: (t) => t.category === 'savings',
  },
  { value: 'crypto', label: 'Crypto', types: TRANSFER_TYPES, match: (t) => t.category === 'crypto' },
  { value: 'refunds', label: 'Remboursements', types: ['refund'], match: (t) => t.type === 'refund' },
]

export const PERIODS: ReadonlyArray<{ value: PeriodValue; label: string; days: number | null; long: string }> = [
  { value: '7', label: '7 j', days: 7, long: '7 derniers jours' },
  { value: '30', label: '30 j', days: 30, long: '30 derniers jours' },
  { value: '90', label: '90 j', days: 90, long: '90 derniers jours' },
  { value: 'all', label: 'Tout', days: null, long: 'Toute la période' },
]

export interface FilterState {
  /** Selected chip values */
  types: string[]
  /** Raw text from the two amount fields (locale decimals allowed) */
  min: string
  max: string
  period: PeriodValue
}

export const EMPTY_FILTER: FilterState = { types: [], min: '', max: '', period: 'all' }

export function isEmptyFilter(f: FilterState): boolean {
  return f.types.length === 0 && f.min.trim() === '' && f.max.trim() === '' && f.period === 'all'
}

function toAmount(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed.replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Start of the day N days ago — stable for the whole day so the query key does not churn. */
function startOfDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)
  return d.toISOString()
}

/**
 * Build the API filter. Returns `undefined` when nothing is filtered, so the screen
 * reuses the plain `transactions:<accountId>` cache entry that the DataProvider patches.
 */
export function toApiFilter(state: FilterState, query: string, now = new Date()): TransactionFilter | undefined {
  const filter: TransactionFilter = {}
  let used = false

  if (state.types.length) {
    const set = new Set<TransactionType>()
    for (const chip of TYPE_CHIPS) if (state.types.includes(chip.value)) for (const t of chip.types) set.add(t)
    filter.types = Array.from(set).sort()
    used = true
  }
  const min = toAmount(state.min)
  if (min !== undefined) {
    filter.minAmount = min
    used = true
  }
  const max = toAmount(state.max)
  if (max !== undefined) {
    filter.maxAmount = max
    used = true
  }
  const period = PERIODS.find((p) => p.value === state.period)
  if (period?.days) {
    filter.from = startOfDaysAgo(period.days, now)
    used = true
  }
  const q = query.trim()
  if (q) {
    filter.query = q
    used = true
  }
  return used ? filter : undefined
}

/** Narrow an API result to the exact union of the selected chips. */
export function narrow(list: Transaction[], state: FilterState): Transaction[] {
  if (!state.types.length) return list
  const chips = TYPE_CHIPS.filter((c) => state.types.includes(c.value))
  return list.filter((t) => chips.some((c) => c.match(t)))
}

/** One badge per active criterion, for the summary line above the list. */
export function describeFilter(state: FilterState, formatAmount: (n: number) => string): string[] {
  const out: string[] = []
  for (const chip of TYPE_CHIPS) if (state.types.includes(chip.value)) out.push(chip.label)
  const min = toAmount(state.min)
  const max = toAmount(state.max)
  if (min !== undefined && max !== undefined) out.push(`${formatAmount(min)} à ${formatAmount(max)}`)
  else if (min !== undefined) out.push(`${formatAmount(min)} et plus`)
  else if (max !== undefined) out.push(`${formatAmount(max)} et moins`)
  const period = PERIODS.find((p) => p.value === state.period)
  if (period?.days) out.push(period.long)
  return out
}
