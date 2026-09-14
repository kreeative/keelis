/**
 * Crypto-area hooks. Thin wrappers over the shared store so every screen uses the
 * same QK cache keys, plus a price-tick subscription and a media-query helper.
 */
import { useEffect, useReducer, useSyncExternalStore } from 'react'
import { api } from '@/api'
import type { Account, AccountKind, ChartRange, CryptoAsset, Holding, PriceHistory, RecurringBuy, Transaction } from '@/api/types'
import { QK, setQueryData, useMarket, useQuery } from '@/store'

/** Optimistic cache patch (alias kept for readability at call sites). */
export const patchQuery = setQueryData

/** Re-render on every price tick (MarketProvider patches the asset caches). */
export function usePriceTicks() {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => api.crypto.subscribePrices(() => bump()), [])
}

// ---------- data hooks (shared QK keys) ----------

export function useLiveAssets() {
  const market = useMarket()
  const q = useQuery<CryptoAsset[]>(QK.assets, () => api.crypto.listAssets())
  usePriceTicks()
  const assets = q.data ?? market.assets
  return { assets, loading: assets === undefined && (q.loading || market.loading), error: assets === undefined ? (q.error ?? market.error) : null, refetch: q.refetch }
}

export function useLiveAsset(id: string) {
  const { assets } = useLiveAssets()
  const q = useQuery<CryptoAsset>(id ? QK.asset(id) : null, () => api.crypto.getAsset(id))
  const cached = assets?.find((a) => a.id === id)
  return { ...q, data: q.data ?? cached, loading: q.loading && !cached }
}

export function useLiveHistory(id: string, range: ChartRange) {
  return useQuery<PriceHistory>(id ? QK.history(id, range) : null, () => api.crypto.history(id, range), { staleTime: 60_000 })
}

export function useLiveAccounts() {
  return useQuery<Account[]>(QK.accounts, () => api.accounts.list())
}

/** By kind, not by id — the id belongs to whichever back-end is answering. */
export function useLiveAccount(kind: AccountKind) {
  const q = useLiveAccounts()
  return { ...q, data: q.data?.find((a) => a.kind === kind) }
}

export function useLiveHoldings() {
  return useQuery<Holding[]>(QK.holdings, () => api.crypto.holdings())
}

export function useLiveRecurring() {
  return useQuery<RecurringBuy[]>(QK.recurring, () => api.crypto.recurring.list())
}

export function useLiveTransaction(id: string | undefined) {
  return useQuery<Transaction>(id ? QK.transaction(id) : null, () => api.transactions.get(id!))
}

/** Generic passthrough for area-specific keys (receive addresses, …). */
export const useLiveQuery = useQuery

// ---------- layout ----------

function subscribeMq(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia?.(query)
    mq?.addEventListener?.('change', cb)
    return () => mq?.removeEventListener?.('change', cb)
  }
}

/** true when the media query matches (SSR/jsdom safe). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeMq(query),
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
    () => false,
  )
}

/** ≥ 768px — desktop rail layout (mirrors the CSS breakpoint in tokens.css). */
export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
