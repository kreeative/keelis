/**
 * Shared data hooks. Every screen reads through these so cache keys stay consistent.
 */
import { api } from '@/api'
import type { Account, AccountKind, AppNotification, Card, Holding, RecurringBuy, SavingsGoal, SavingsSummary, Transaction, TransactionFilter } from '@/api/types'
import { QK, useQuery } from '@/store'

export function useAccounts() {
  return useQuery<Account[]>(QK.accounts, () => api.accounts.list())
}

/**
 * An account is found by **what it is**, never by a hard-coded id.
 *
 * The screens used to look up `IDS.checking`, a constant from the mock seed — which meant
 * that the day a real back-end returned its own identifiers, every screen would quietly
 * find nothing and render an empty state. `kind` is part of the contract; the id is the
 * server's business.
 */
export function useAccount(kind: AccountKind) {
  const q = useAccounts()
  return { ...q, data: q.data?.find((a) => a.kind === kind) }
}

/** The id of that account, once it is known. `undefined` while the list is loading. */
export function useAccountId(kind: AccountKind): string | undefined {
  return useAccount(kind).data?.id
}

/** scope: 'all' | accountId | 'recent' (5 most recent across accounts) */
export function useTransactions(scope: 'all' | 'recent' | string = 'all', filter?: TransactionFilter) {
  const key = QK.transactions(scope + (filter ? ':' + JSON.stringify(filter) : ''))
  return useQuery<Transaction[]>(key, () => {
    if (scope === 'recent') return api.transactions.list({ limit: 5, ...filter })
    if (scope === 'all') return api.transactions.list(filter)
    return api.transactions.list({ accountId: scope, ...filter })
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery<Transaction>(id ? QK.transaction(id) : null, () => api.transactions.get(id!))
}

export function useCard() {
  return useQuery<Card>(QK.card, () => api.card.get())
}

export function useHoldings() {
  return useQuery<Holding[]>(QK.holdings, () => api.crypto.holdings())
}

export function useRecurring() {
  return useQuery<RecurringBuy[]>(QK.recurring, () => api.crypto.recurring.list())
}

export function useSavings() {
  return useQuery<SavingsSummary>(QK.savings, () => api.savings.summary())
}

export function useGoals() {
  return useQuery<SavingsGoal[]>(QK.goals, () => api.savings.goals.list())
}

export function useNotifications() {
  return useQuery<AppNotification[]>(QK.notifications, () => api.notifications.list())
}

/** Group transactions by local day, newest first. */
export function groupByDay(txs: Transaction[]): Array<{ day: string; date: string; items: Transaction[] }> {
  const map = new Map<string, { day: string; date: string; items: Transaction[] }>()
  for (const t of txs) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    let g = map.get(key)
    if (!g) {
      g = { day: key, date: t.date, items: [] }
      map.set(key, g)
    }
    g.items.push(t)
  }
  return Array.from(map.values()).sort((a, b) => (a.day < b.day ? 1 : -1))
}
