/**
 * Crypto prices and histories from CoinGecko's public API.
 *
 * No key is needed for the free tier, which is enough for eight coins read once a minute;
 * a demo key (`COINGECKO_API_KEY`) raises the rate limit and goes in a header, never in a
 * URL that ends up in a log. Everything is asked for **in euros** and crossed to francs
 * once, at exactly the treaty peg — the same single crossing the seed makes — so a bitcoin
 * that CoinGecko quotes at 60 000 € reads 39 357 420 F CFA here and nowhere else in the
 * chain is a rate applied to it.
 *
 * The two parsers are pure and exported: the sandbox this was written in cannot reach the
 * API at all, so they are tested against recorded response shapes and the owner runs
 * `pnpm feeds:probe` where the network is open.
 */

const BASE = 'https://api.coingecko.com/api/v3'

/**
 * The app's asset ids against CoinGecko's. An id missing here is simply not priced — it
 * stays a demonstration figure, and the asset page keeps saying so.
 */
export const COINGECKO_IDS = Object.freeze({
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  xrp: 'ripple',
  ada: 'cardano',
  doge: 'dogecoin',
  link: 'chainlink',
  avax: 'avalanche-2',
})

/** How far back each chart range asks for. CoinGecko picks the granularity from `days`. */
const DAYS = { '1D': '1', '1W': '7', '1M': '30', '1Y': '365', MAX: 'max' }

/** How many points a range keeps — the mock's own counts, so the chart draws the same. */
const KEEP = { '1D': 288, '1W': 168, '1M': 240, '1Y': 365, MAX: 520 }

function headers(env) {
  const h = { Accept: 'application/json' }
  if (env.COINGECKO_API_KEY) h['x-cg-demo-api-key'] = env.COINGECKO_API_KEY
  return h
}

/**
 * `/simple/price` → one update per asset the map covers and the answer holds.
 *
 * A coin the answer lacks, or quotes without a euro figure, is skipped rather than zeroed:
 * a price of 0 written into the book would value a holding at nothing.
 */
export function parseSimplePrice(json, xofPerEur, ids = COINGECKO_IDS) {
  const out = []
  for (const [id, cg] of Object.entries(ids)) {
    const row = json?.[cg]
    if (!row || typeof row.eur !== 'number' || !(row.eur > 0)) continue
    const change = typeof row.eur_24h_change === 'number' ? row.eur_24h_change : 0
    out.push({
      id,
      price: row.eur * xofPerEur,
      change24hPct: change,
      marketCap: typeof row.eur_market_cap === 'number' ? row.eur_market_cap * xofPerEur : undefined,
      volume24h: typeof row.eur_24h_vol === 'number' ? row.eur_24h_vol * xofPerEur : undefined,
      updatedAt: typeof row.last_updated_at === 'number' ? new Date(row.last_updated_at * 1000).toISOString() : undefined,
    })
  }
  return out
}

/**
 * `/coins/{id}/market_chart` → `{ t, p }` points in francs, thinned to the range's count.
 *
 * Thinning keeps the first and the last point exactly: the last is the price the hero
 * prints, and the first is what the range's change is measured from.
 */
export function parseMarketChart(json, xofPerEur, range = '1M') {
  const prices = Array.isArray(json?.prices) ? json.prices : []
  const pts = []
  for (const row of prices) {
    if (!Array.isArray(row) || row.length < 2) continue
    const [t, p] = row
    if (typeof t !== 'number' || typeof p !== 'number' || !(p > 0)) continue
    pts.push({ t, p: p * xofPerEur })
  }
  pts.sort((a, b) => a.t - b.t)
  return thin(pts, KEEP[range] ?? 365)
}

/** Keep at most `max` points, evenly spaced, first and last exact. */
export function thin(points, max) {
  if (points.length <= max) return points
  const out = []
  for (let i = 0; i < max; i += 1) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))])
  return out
}

async function getJson(url, env, fetchImpl) {
  const res = await fetchImpl(url, { headers: headers(env), signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`CoinGecko ${res.status} sur ${new URL(url).pathname}`)
  return res.json()
}

export async function fetchPrices({ xofPerEur, env = process.env, fetch: fetchImpl = globalThis.fetch, ids = COINGECKO_IDS }) {
  const url = `${BASE}/simple/price?ids=${Object.values(ids).join(',')}&vs_currencies=eur&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
  return parseSimplePrice(await getJson(url, env, fetchImpl), xofPerEur, ids)
}

export async function fetchHistory({ id, range, xofPerEur, env = process.env, fetch: fetchImpl = globalThis.fetch, ids = COINGECKO_IDS }) {
  const cg = ids[id]
  if (!cg) return null
  const days = DAYS[range]
  if (!days) return null
  const url = `${BASE}/coins/${cg}/market_chart?vs_currency=eur&days=${days}`
  return parseMarketChart(await getJson(url, env, fetchImpl), xofPerEur, range)
}
