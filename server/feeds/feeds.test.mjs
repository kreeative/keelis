/**
 * The feed parsers, against recorded response shapes, and the orchestrator against a fake
 * `fetch`. The shapes in `fixtures/` are the providers' documented ones, written by hand
 * in a sandbox that could not reach any of them — which is why `pnpm feeds:probe` exists,
 * and why nothing here claims a provider is up.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { COINGECKO_IDS, parseMarketChart, parseSimplePrice, thin } from './coingecko.mjs'
import { EODHD_SYMBOLS, parseEod, parseRealTime, toXof } from './equities.mjs'
import { createFeeds } from './index.mjs'
import { parseRates } from './rates.mjs'

const PEG = 655.957
const fixture = (name) => JSON.parse(readFileSync(join(process.cwd(), 'server/feeds/fixtures', name), 'utf8'))
const CURRENCIES = ['XOF', 'XAF', 'NGN', 'ZAR', 'EGP', 'KES', 'GHS', 'MAD', 'TZS', 'UGX', 'RWF', 'ETB', 'DZD', 'TND', 'EUR', 'USD']
const DEMO = { EUR: 1, XOF: PEG, XAF: PEG, USD: 1.08, NGN: 1700, ZAR: 19.8, EGP: 53, KES: 140, GHS: 16, MAD: 10.8, TZS: 2900, UGX: 4000, RWF: 1400, ETB: 125, DZD: 145, TND: 3.4 }

describe('CoinGecko', () => {
  it('crosses euros to francs once, at the peg, and skips what it cannot price', () => {
    const out = parseSimplePrice(fixture('coingecko-simple-price.json'), PEG)
    const btc = out.find((u) => u.id === 'btc')
    expect(btc.price).toBeCloseTo(60_000 * PEG, 6)
    expect(btc.change24hPct).toBe(1.25)
    expect(btc.marketCap).toBeCloseTo(1_180_000_000_000 * PEG, 0)
    expect(btc.updatedAt).toBe(new Date(1758600000 * 1000).toISOString())
    // ripple answered in dollars only; cardano at zero. Neither is a price.
    expect(out.map((u) => u.id).sort()).toEqual(['btc', 'eth', 'sol'])
  })

  it('maps every coin the seed lists', () => {
    for (const id of ['btc', 'eth', 'sol', 'xrp', 'ada', 'doge', 'link', 'avax']) expect(COINGECKO_IDS[id]).toBeTruthy()
  })

  it('reads a market chart oldest first, in francs', () => {
    const pts = parseMarketChart(fixture('coingecko-market-chart.json'), PEG, '1D')
    expect(pts).toHaveLength(5)
    expect(pts[0].t).toBeLessThan(pts[4].t)
    expect(pts[4].p).toBeCloseTo(60_000 * PEG, 6)
  })

  it('thins a long series and keeps both ends exact', () => {
    const long = Array.from({ length: 4000 }, (_, i) => ({ t: i, p: 1 + i }))
    const out = thin(long, 520)
    expect(out).toHaveLength(520)
    expect(out[0]).toEqual(long[0])
    expect(out[519]).toEqual(long[3999])
    expect(thin(long.slice(0, 10), 520)).toHaveLength(10)
  })
})

describe('the rate table', () => {
  it('keeps only the currencies the app holds and reports the ones missing', () => {
    const r = parseRates(fixture('erapi-latest-eur.json'), CURRENCIES)
    expect(r.perEur.NGN).toBe(1795.4)
    expect(r.perEur.GBP).toBeUndefined()
    expect(r.missing).toEqual([])
    expect(r.updatedAt).toBe(new Date(1758585601 * 1000).toISOString())
    // The feed's rounded peg is passed through here; pinning it is the app's job.
    expect(r.perEur.XOF).toBe(655.96)
  })

  it('refuses an answer that is not a success', () => {
    expect(() => parseRates({ result: 'error', 'error-type': 'quota' }, CURRENCIES)).toThrow(/error/)
  })
})

describe('EODHD equities', () => {
  const table = { ...DEMO, NGN: 1795.4, ZAR: 20.31, KES: 151.2 }

  it('crosses a local close to francs at the mid rate and scales the JSE out of cents', () => {
    const out = parseRealTime(fixture('eodhd-real-time.json'), table)
    const ids = out.map((u) => u.id).sort()
    // MTNN has not traded: every figure is "NA", and "NA" is not a price of nothing.
    expect(ids).toEqual(['dangcem', 'naspers', 'safaricom'])
    const dangcem = out.find((u) => u.id === 'dangcem')
    expect(dangcem.price).toBeCloseTo((485 * PEG) / 1795.4, 6)
    expect(dangcem.change24hPct).toBeCloseTo(1.0417, 4)
    const npn = out.find((u) => u.id === 'naspers')
    expect(npn.local).toBe(4842)
    expect(npn.price).toBeCloseTo((4842 * PEG) / 20.31, 6)
  })

  it('lists the BRVM as uncovered rather than omitting it', () => {
    expect(EODHD_SYMBOLS.sonatel).toBeNull()
    expect(Object.keys(EODHD_SYMBOLS)).toContain('sonabel')
    expect(toXof(100, 'NGN', { XOF: PEG })).toBeNull()
  })

  it('sorts daily closes oldest first', () => {
    const pts = parseEod(fixture('eodhd-eod.json'), EODHD_SYMBOLS.dangcem, table)
    expect(pts.map((p) => new Date(p.t).toISOString().slice(0, 10))).toEqual(['2026-09-18', '2026-09-19', '2026-09-22'])
    expect(pts[2].p).toBeCloseTo((480 * PEG) / 1795.4, 6)
  })
})

function fakeFetch(routes) {
  const calls = []
  const fetch = vi.fn(async (url) => {
    calls.push(String(url))
    for (const [needle, body] of routes) {
      if (String(url).includes(needle)) {
        if (body instanceof Error) throw body
        return { ok: true, status: 200, json: async () => body }
      }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  return { fetch, calls }
}

function hooks() {
  return { setPrices: vi.fn(), setSeries: vi.fn(), setRates: vi.fn(), setSources: vi.fn() }
}

describe('the orchestrator', () => {
  it('writes prices, rates and sources in through the hooks', async () => {
    const h = hooks()
    const { fetch } = fakeFetch([
      ['/simple/price', fixture('coingecko-simple-price.json')],
      ['open.er-api.com', fixture('erapi-latest-eur.json')],
      ['/real-time/', fixture('eodhd-real-time.json')],
    ])
    const feeds = createFeeds({ hooks: h, xofPerEur: PEG, demoPerEur: DEMO, currencies: CURRENCIES, env: { EODHD_API_KEY: 'k' }, fetch, log: () => {} })
    await feeds.refreshRates()
    await feeds.refreshCrypto()
    await feeds.refreshEquities()
    expect(h.setRates).toHaveBeenCalledWith(expect.objectContaining({ NGN: 1795.4 }), 'ExchangeRate-API', expect.any(String))
    expect(h.setPrices).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'btc' })]), { provider: 'CoinGecko', updatedAt: expect.any(String) })
    // Equities were crossed through the *live* table, read a moment before.
    const equityCall = h.setPrices.mock.calls.find(([, s]) => s.provider === 'EODHD')
    expect(equityCall[0].find((u) => u.id === 'dangcem').price).toBeCloseTo((485 * PEG) / 1795.4, 6)
    const rows = feeds.sources()
    expect(rows.map((r) => `${r.kind}:${r.status}`)).toEqual(['crypto:live', 'equity:live', 'fx:live'])
    expect(rows.find((r) => r.kind === 'equity').detail).toMatch(/3 titres sur 7/)
    expect(h.setSources).toHaveBeenCalled()
  })

  it('reports a failing feed as an error and writes nothing in', async () => {
    const h = hooks()
    const { fetch } = fakeFetch([['/simple/price', new Error('ECONNRESET')]])
    const feeds = createFeeds({ hooks: h, xofPerEur: PEG, demoPerEur: DEMO, currencies: CURRENCIES, env: {}, fetch, log: () => {} })
    await feeds.refreshCrypto()
    expect(h.setPrices).not.toHaveBeenCalled()
    const crypto = feeds.sources().find((r) => r.kind === 'crypto')
    expect(crypto.status).toBe('error')
    expect(crypto.detail).toMatch(/ECONNRESET/)
    // No key: the equities are demonstration, and the row says why.
    const equity = feeds.sources().find((r) => r.kind === 'equity')
    expect(equity.status).toBe('demo')
    expect(equity.detail).toMatch(/EODHD_API_KEY/)
  })

  it('is off when FEEDS=off, and every row says demo', async () => {
    const h = hooks()
    const { fetch, calls } = fakeFetch([])
    const feeds = createFeeds({ hooks: h, xofPerEur: PEG, demoPerEur: DEMO, currencies: CURRENCIES, env: { FEEDS: 'off' }, fetch, log: () => {} })
    await feeds.start()
    await feeds.ensureHistory('btc', '1D')
    expect(calls).toEqual([])
    expect(feeds.sources().every((r) => r.status === 'demo')).toBe(true)
    expect(h.setSources).toHaveBeenCalledTimes(1)
  })

  it('fetches a history once per range until it is stale, and shares an in-flight fetch', async () => {
    const h = hooks()
    const { fetch, calls } = fakeFetch([['/market_chart', fixture('coingecko-market-chart.json')]])
    const feeds = createFeeds({ hooks: h, xofPerEur: PEG, demoPerEur: DEMO, currencies: CURRENCIES, env: {}, fetch, log: () => {} })
    await Promise.all([feeds.ensureHistory('btc', '1D'), feeds.ensureHistory('btc', '1D')])
    await feeds.ensureHistory('btc', '1D')
    expect(calls.filter((c) => c.includes('market_chart'))).toHaveLength(1)
    expect(h.setSeries).toHaveBeenCalledWith('btc', '1D', expect.any(Array))
    // An asset no feed covers costs no call at all.
    await feeds.ensureHistory('sonatel', '1M')
    expect(calls).toHaveLength(1)
  })
})
