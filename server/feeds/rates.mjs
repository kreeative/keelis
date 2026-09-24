/**
 * Exchange rates against the euro, from open.er-api.com — the keyless endpoint of
 * ExchangeRate-API, refreshed by them once a day, which is the cadence a rate table for a
 * conversion screen needs. The euro is the base because the two pegs are to it.
 *
 * The parser takes only the currencies the app holds, and it does **not** pin the pegs:
 * that is `pinPegs` in `lib/fx.ts`, on the app side of the seam, so the treaty is enforced
 * where the table is used and not only where it is fetched.
 */

const URL_EUR = 'https://open.er-api.com/v6/latest/EUR'

/** `/v6/latest/EUR` → a partial table, units per euro, for the currencies asked for. */
export function parseRates(json, currencies) {
  if (json?.result !== 'success' || !json.rates || typeof json.rates !== 'object') {
    throw new Error(`Réponse inattendue du fournisseur de taux : ${json?.result ?? 'sans résultat'}`)
  }
  const perEur = {}
  for (const code of currencies) {
    const v = json.rates[code]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) perEur[code] = v
  }
  const updatedAt = typeof json.time_last_update_unix === 'number' ? new Date(json.time_last_update_unix * 1000).toISOString() : new Date().toISOString()
  return { perEur, updatedAt, missing: currencies.filter((c) => !(c in perEur)) }
}

export async function fetchRates({ currencies, fetch: fetchImpl = globalThis.fetch }) {
  const res = await fetchImpl(URL_EUR, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Fournisseur de taux : ${res.status}`)
  return parseRates(await res.json(), currencies)
}
