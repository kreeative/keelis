/**
 * Wires API events into the query cache so every screen stays live:
 * a pending transaction appears immediately, then resolves in place.
 */
import { useEffect, type ReactNode } from 'react'
import { api } from '@/api'
import type { Transaction } from '@/api/types'
import { invalidate, setQueryData } from './query'
import { useSession } from './session'

export const QK = {
  accounts: 'accounts',
  account: (id: string) => `accounts/${id}`,
  accountDetails: (id: string) => `accounts/${id}/details`,
  accountsHistory: (range: string) => `accounts:history/${range}`,
  cryptoPortfolioHistory: (range: string) => `crypto:portfolio-history/${range}`,
  transferProviders: 'transfers:providers',
  transactions: (scope = 'all') => `transactions:${scope}`,
  transaction: (id: string) => `transactions/${id}`,
  card: 'card',
  me: 'me',
  risk: 'me:risk',
  assets: 'crypto:assets',
  asset: (id: string) => `crypto:assets/${id}`,
  history: (id: string, range: string) => `crypto:history/${id}/${range}`,
  holdings: 'crypto:holdings',
  recurring: 'crypto:recurring',
  savings: 'savings:summary',
  savingsHistory: (range: string) => `savings:history/${range}`,
  goals: 'savings:goals',
  fundingSources: 'funding:sources',
  notifications: 'notifications',
  papos: 'learn:papos',
  fxRates: 'fx:rates',
  marketSources: 'market:sources',
  notificationPrefs: 'notifications:prefs',
  security: 'profile:security',
  devices: 'profile:devices',
  statements: 'profile:statements',
  taxDocs: 'profile:tax',
} as const

function upsertTransaction(list: Transaction[] | undefined, tx: Transaction): Transaction[] {
  if (!list) return [tx]
  const idx = list.findIndex((t) => t.id === tx.id)
  if (idx === -1) return [tx, ...list]
  const next = list.slice()
  next[idx] = tx
  return next
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  useEffect(() => {
    if (status !== 'authenticated') return
    const off = api.subscribe((e) => {
      switch (e.type) {
        case 'transaction':
          // Patch every mounted transaction list optimistically, then let them refetch.
          setQueryData<Transaction[]>(QK.transactions('all'), (prev) => upsertTransaction(prev, e.transaction))
          setQueryData<Transaction[]>(QK.transactions(e.transaction.accountId), (prev) => upsertTransaction(prev, e.transaction))
          setQueryData<Transaction[]>(QK.transactions('recent'), (prev) => upsertTransaction(prev, e.transaction).slice(0, 5))
          setQueryData<Transaction>(QK.transaction(e.transaction.id), () => e.transaction)
          invalidate('transactions')
          break
        case 'accounts':
          invalidate('accounts')
          invalidate('crypto:holdings')
          invalidate('savings:summary')
          break
        case 'card':
          setQueryData(QK.card, () => e.card)
          break
        case 'notification':
          invalidate('notifications')
          break
        case 'goals':
          invalidate('savings:goals')
          break
        case 'recurring':
          invalidate('crypto:recurring')
          break
      }
    })
    return off
  }, [status])
  return <>{children}</>
}
