/**
 * The market feeds, run by the reference back-end.
 *
 * `createFeeds` polls the three providers on their own cadences and writes what they
 * return into the mock state through four hooks — prices, series, the rate table and the
 * source rows. Nothing else changes: the same `mockApi` serves `/assets`, only some of the
 * figures in it are now true. What is *not* covered stays a demonstration figure, and
 * stays labelled as one, because half the point of a feed is that the app can say which
 * numbers are real.
 *
 * Cadences are the providers', not ours. CoinGecko's free tier is a few dozen calls a
 * minute, so prices are read once a minute and histories only when a chart asks for one,
 * then kept for a while. Rates change daily at the source, so they are read every six
 * hours. Equities are read every five minutes, which is what a delayed feed is.
 *
 * `FEEDS=off` turns the whole thing off — the e2e walk against the server sets it, because
 * a test that depends on a third party's uptime is a test that fails on their schedule.
 */
import * as coingecko from './coingecko.mjs'
import * as equities from './equities.mjs'
import * as rates from './rates.mjs'

const MINUTE = 60_000

/** How long a fetched history is served before it is fetched again. */
const HISTORY_TTL = { '1D': 5 * MINUTE, '1W': 30 * MINUTE, '1M': 6 * 60 * MINUTE, '1Y': 24 * 60 * MINUTE, MAX: 24 * 60 * MINUTE }

const RANGES = new Set(['1D', '1W', '1M', '1Y', 'MAX'])

export function createFeeds({ hooks, xofPerEur, currencies, demoPerEur, env = process.env, fetch: fetchImpl = globalThis.fetch, log = console.log }) {
  const enabled = (env.FEEDS ?? 'on').toLowerCase() !== 'off'
  const cryptoMs = Number(env.FEEDS_CRYPTO_MS ?? MINUTE)
  const fxMs = Number(env.FEEDS_FX_MS ?? 6 * 60 * MINUTE)
  const equityMs = Number(env.FEEDS_EQUITY_MS ?? 5 * MINUTE)
  const equityKey = env.EODHD_API_KEY?.trim() || null

  /** The table equities are crossed through: demonstration until the FX feed has read. */
  let perEur = { ...demoPerEur }

  const status = {
    crypto: { kind: 'crypto', status: enabled ? 'error' : 'demo', provider: 'CoinGecko' },
    equity: { kind: 'equity', status: enabled && equityKey ? 'error' : 'demo', provider: equityKey ? 'EODHD' : undefined },
    fx: { kind: 'fx', status: enabled ? 'error' : 'demo', provider: 'ExchangeRate-API' },
  }
  const covered = equities.coveredIds()
  const total = Object.keys(equities.EODHD_SYMBOLS).length
  if (!equityKey) status.equity.detail = `Aucune clé EODHD_API_KEY : les ${total} titres restent des cours de démonstration. La BRVM n’est couverte par aucun flux public.`

  const publish = () => hooks.setSources(Object.values(status).map((s) => ({ ...s })))

  function fail(kind, err) {
    const s = status[kind]
    /* A feed that has read once and now fails keeps showing its last figures — the mock
       still holds them — and says the read is stale; one that never read stays demo. */
    s.status = 'error'
    s.detail = `Dernière lecture en échec : ${err?.message ?? err}`
    log(`[feeds] ${kind}: ${err?.message ?? err}`)
    publish()
  }

  async function refreshCrypto() {
    try {
      const updates = await coingecko.fetchPrices({ xofPerEur, env, fetch: fetchImpl })
      if (updates.length === 0) throw new Error('aucun cours dans la réponse')
      const updatedAt = new Date().toISOString()
      hooks.setPrices(updates, { provider: 'CoinGecko', updatedAt })
      Object.assign(status.crypto, { status: 'live', updatedAt, detail: `${updates.length} cryptomonnaies, en euros croisés à la parité.` })
      publish()
    } catch (err) {
      fail('crypto', err)
    }
  }

  async function refreshRates() {
    try {
      const r = await rates.fetchRates({ currencies, fetch: fetchImpl })
      const live = currencies.filter((c) => c !== 'EUR' && c !== 'XOF' && c !== 'XAF')
      const got = live.filter((c) => c in r.perEur)
      if (got.length === 0) throw new Error('aucune devise dans la réponse')
      hooks.setRates(r.perEur, 'ExchangeRate-API', r.updatedAt)
      perEur = { ...demoPerEur, ...r.perEur, EUR: 1, XOF: xofPerEur, XAF: xofPerEur }
      const missing = live.filter((c) => !(c in r.perEur))
      Object.assign(status.fx, {
        status: 'live',
        updatedAt: r.updatedAt,
        detail: missing.length ? `${got.length} devises cotées ; ${missing.join(', ')} en démonstration. XOF et XAF à la parité.` : `${got.length} devises cotées ; XOF et XAF à la parité.`,
      })
      publish()
    } catch (err) {
      fail('fx', err)
    }
  }

  async function refreshEquities() {
    if (!equityKey) return
    try {
      const updates = await equities.fetchPrices({ key: equityKey, perEur, fetch: fetchImpl })
      if (updates.length === 0) throw new Error('aucun cours dans la réponse')
      const updatedAt = new Date().toISOString()
      hooks.setPrices(updates, { provider: 'EODHD', updatedAt })
      const uncovered = total - covered.length
      Object.assign(status.equity, {
        status: 'live',
        updatedAt,
        detail: `${updates.length} titres sur ${total} (NGX, JSE, NSE) ; ${uncovered} titres BRVM en démonstration. Historiques journaliers ; l’intrajournalier reste simulé.`,
      })
      publish()
    } catch (err) {
      fail('equity', err)
    }
  }

  /* Histories, on demand. Two charts asking for the same series at once share one fetch. */
  const fetched = new Map()
  const inflight = new Map()

  async function ensureHistory(id, range) {
    if (!enabled || !RANGES.has(range)) return
    const key = `${id}/${range}`
    const until = fetched.get(key)
    if (until && until > Date.now()) return
    if (inflight.has(key)) return inflight.get(key)
    const job = (async () => {
      try {
        let pts = null
        if (id in coingecko.COINGECKO_IDS) pts = await coingecko.fetchHistory({ id, range, xofPerEur, env, fetch: fetchImpl })
        else if (equityKey && equities.EODHD_SYMBOLS[id]) pts = await equities.fetchHistory({ id, range, key: equityKey, perEur, fetch: fetchImpl })
        if (pts && pts.length >= 2) {
          hooks.setSeries(id, range, pts)
          fetched.set(key, Date.now() + HISTORY_TTL[range])
        }
      } catch (err) {
        log(`[feeds] history ${key}: ${err?.message ?? err}`)
        /* Do not hammer a failing endpoint: wait a minute before asking for it again. */
        fetched.set(key, Date.now() + MINUTE)
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, job)
    return job
  }

  const timers = []

  return {
    enabled,
    async start() {
      publish()
      if (!enabled) {
        log('[feeds] désactivés (FEEDS=off) : cours et taux de démonstration')
        return
      }
      log(`[feeds] CoinGecko toutes les ${cryptoMs / 1000} s, taux toutes les ${fxMs / MINUTE} min${equityKey ? `, EODHD toutes les ${equityMs / MINUTE} min` : ', pas de clé EODHD'}`)
      /* Rates first, since equities are crossed through them. */
      await refreshRates()
      await Promise.all([refreshCrypto(), refreshEquities()])
      timers.push(setInterval(refreshCrypto, cryptoMs), setInterval(refreshRates, fxMs))
      if (equityKey) timers.push(setInterval(refreshEquities, equityMs))
      for (const t of timers) t.unref?.()
    },
    stop() {
      for (const t of timers) clearInterval(t)
      timers.length = 0
    },
    ensureHistory,
    sources: () => Object.values(status).map((s) => ({ ...s })),
    /** For the probe and the tests. */
    refreshCrypto,
    refreshRates,
    refreshEquities,
  }
}
