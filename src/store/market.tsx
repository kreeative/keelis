/**
 * Live crypto prices. Subscribes to the API price feed (polling / socket) and
 * keeps the last known values while a refetch is in flight — never zero.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { api } from '@/api'
import type { CryptoAsset } from '@/api/types'
import { QK } from './data'
import { invalidate, setQueryData, useQuery } from './query'
import { useSession } from './session'

interface MarketCtx {
  assets: CryptoAsset[] | undefined
  loading: boolean
  error: ReturnType<typeof useQuery<CryptoAsset[]>>['error']
  refetch: () => Promise<void>
  byId: Map<string, CryptoAsset>
  lastTick: number
}

const Ctx = createContext<MarketCtx | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const q = useQuery<CryptoAsset[]>(status === 'authenticated' ? QK.assets : null, () => api.crypto.listAssets())

  useEffect(() => {
    if (status !== 'authenticated') return
    const off = api.crypto.subscribePrices((assets) => {
      setQueryData<CryptoAsset[]>(QK.assets, () => assets)
      for (const a of assets) setQueryData<CryptoAsset>(QK.asset(a.id), (prev) => ({ ...(prev ?? a), ...a, watched: prev?.watched ?? a.watched }))
      invalidate('crypto:holdings')
      invalidate('accounts')
    })
    return off
  }, [status])

  const value = useMemo<MarketCtx>(() => {
    const byId = new Map<string, CryptoAsset>()
    for (const a of q.data ?? []) byId.set(a.id, a)
    return { assets: q.data, loading: q.loading, error: q.error, refetch: q.refetch, byId, lastTick: q.updatedAt }
  }, [q.data, q.loading, q.error, q.refetch, q.updatedAt])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMarket(): MarketCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}

/** A single asset with live price; falls back to the market cache while loading. */
export function useAsset(id: string | undefined) {
  const market = useMarket()
  const q = useQuery<CryptoAsset>(id ? QK.asset(id) : null, () => api.crypto.getAsset(id!))
  const cached = id ? market.byId.get(id) : undefined
  return { ...q, data: q.data ?? cached, loading: q.loading && !cached }
}
