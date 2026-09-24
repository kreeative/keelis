/**
 * African equities, through a keyed provider — EODHD's shape, because it is the one
 * provider with a public price list that covers Lagos, Johannesburg and Nairobi.
 *
 * **There is no free feed for the BRVM**, and this file does not pretend there is. The
 * three Abidjan listings are mapped to `null`: they stay demonstration figures, the asset
 * page keeps saying so, and the « Données et connexion » screen counts them. When the owner
 * signs with a provider that carries the BRVM, this map is the one edit.
 *
 * Every symbol is quoted in its exchange's own currency — naira, rand, shilling — and
 * crossed to francs through the rate table the FX feed maintains, at the mid rate: a book
 * value is a valuation, not a trade, so it takes no spread. The JSE is the trap: EODHD
 * quotes it in **cents** (ZAC), so Naspers carries a scale of 0.01. `pnpm feeds:probe`
 * prints the raw figure beside the converted one so a wrong scale is seen before it is
 * shipped.
 */

const BASE = 'https://eodhd.com/api'

/**
 * The app's asset ids against the provider's symbols. `null` means « not covered », and
 * is listed rather than omitted so the count on the data screen is honest.
 */
export const EODHD_SYMBOLS = Object.freeze({
  dangcem: { symbol: 'DANGCEM.XNSA', currency: 'NGN', scale: 1 },
  mtnn: { symbol: 'MTNN.XNSA', currency: 'NGN', scale: 1 },
  naspers: { symbol: 'NPN.JSE', currency: 'ZAR', scale: 0.01 },
  safaricom: { symbol: 'SCOM.XNAI', currency: 'KES', scale: 1 },
  /* BRVM — no provider in the free or demo tiers carries Abidjan. */
  sonatel: null,
  nsiabrvm: null,
  sonabel: null,
})

/** Cross a local figure to francs at the mid rate of the table given. */
export function toXof(local, currency, perEur) {
  const from = perEur[currency]
  const xof = perEur.XOF
  if (!(from > 0) || !(xof > 0)) return null
  return (local * xof) / from
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * `/real-time/{s}?s=…` → one update per covered id. The provider answers `"NA"` for a
 * figure it does not have — a symbol that has not traded today, say — and a row like that
 * is skipped rather than written in as a price of nothing.
 */
export function parseRealTime(json, perEur, symbols = EODHD_SYMBOLS) {
  const rows = Array.isArray(json) ? json : json ? [json] : []
  const byCode = new Map(rows.map((r) => [r?.code, r]))
  const out = []
  for (const [id, spec] of Object.entries(symbols)) {
    if (!spec) continue
    const row = byCode.get(spec.symbol)
    const close = num(row?.close)
    if (close === null || !(close > 0)) continue
    const price = toXof(close * spec.scale, spec.currency, perEur)
    if (price === null) continue
    const changePct = num(row.change_p) ?? 0
    const ts = num(row.timestamp)
    out.push({ id, price, change24hPct: changePct, local: close * spec.scale, currency: spec.currency, updatedAt: ts !== null ? new Date(ts * 1000).toISOString() : undefined })
  }
  return out
}

/** `/eod/{symbol}` → daily closes as `{ t, p }` in francs, oldest first. */
export function parseEod(json, spec, perEur) {
  const rows = Array.isArray(json) ? json : []
  const pts = []
  for (const r of rows) {
    const close = num(r?.adjusted_close ?? r?.close)
    const t = Date.parse(r?.date ?? '')
    if (close === null || !(close > 0) || Number.isNaN(t)) continue
    const p = toXof(close * spec.scale, spec.currency, perEur)
    if (p !== null) pts.push({ t, p })
  }
  return pts.sort((a, b) => a.t - b.t)
}

/** Which ranges daily closes can serve. `1D` cannot: it is intraday, a paid tier. */
const EOD_FROM = {
  '1W': 8,
  '1M': 31,
  '1Y': 366,
  MAX: 365 * 10,
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`EODHD ${res.status} sur ${new URL(url).pathname}`)
  return res.json()
}

export function coveredIds(symbols = EODHD_SYMBOLS) {
  return Object.entries(symbols).filter(([, s]) => s).map(([id]) => id)
}

export async function fetchPrices({ key, perEur, fetch: fetchImpl = globalThis.fetch, symbols = EODHD_SYMBOLS }) {
  const list = Object.values(symbols).filter(Boolean).map((s) => s.symbol)
  if (list.length === 0) return []
  const [first, ...rest] = list
  const url = `${BASE}/real-time/${first}?api_token=${encodeURIComponent(key)}&fmt=json${rest.length ? `&s=${rest.join(',')}` : ''}`
  return parseRealTime(await getJson(url, fetchImpl), perEur, symbols)
}

export async function fetchHistory({ id, range, key, perEur, fetch: fetchImpl = globalThis.fetch, symbols = EODHD_SYMBOLS }) {
  const spec = symbols[id]
  const days = EOD_FROM[range]
  if (!spec || !days) return null
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const url = `${BASE}/eod/${spec.symbol}?api_token=${encodeURIComponent(key)}&fmt=json&period=d&from=${from}`
  return parseEod(await getJson(url, fetchImpl), spec, perEur)
}
