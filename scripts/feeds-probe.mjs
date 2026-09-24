/**
 * Read each market feed once and print what came back, converted the way the server
 * converts it — so whoever holds the keys can see the figures before the app shows them.
 *
 *     pnpm feeds:probe                       # CoinGecko and the rate table, no key needed
 *     EODHD_API_KEY=… pnpm feeds:probe       # the equities too
 *
 * It exists because the sandbox this feed layer was written in could not reach a single
 * provider: every host answered 403 from the proxy. The parsers are tested against recorded
 * shapes, but a recorded shape is a claim about the provider, and this is the check.
 */
import { createFeeds } from '../server/feeds/index.mjs'
import { createServer as createViteServer } from 'vite'

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { CFA_PER_EUR, DEMO_PER_EUR } = await vite.ssrLoadModule('/src/lib/fx.ts')
const { CURRENCY_ORDER } = await vite.ssrLoadModule('/src/lib/currency.ts')
const { seedAssets } = await vite.ssrLoadModule('/src/api/mock/seed.ts')

const demo = new Map(seedAssets.map((a) => [a.id, a]))
const xof = (n) => `${Math.round(n).toLocaleString('en-US')} F CFA`

const seen = { prices: [], series: [], rates: null, sources: [] }
const feeds = createFeeds({
  hooks: {
    setPrices: (updates, source) => seen.prices.push({ updates, source }),
    setSeries: (id, range, pts) => seen.series.push({ id, range, n: pts.length, first: pts[0], last: pts[pts.length - 1] }),
    setRates: (perEur, provider, updatedAt) => (seen.rates = { perEur, provider, updatedAt }),
    setSources: (rows) => (seen.sources = rows),
  },
  xofPerEur: CFA_PER_EUR,
  demoPerEur: DEMO_PER_EUR,
  currencies: CURRENCY_ORDER,
  env: { ...process.env, FEEDS: 'on' },
  log: (m) => console.error(m),
})

await feeds.refreshRates()
await feeds.refreshCrypto()
await feeds.refreshEquities()
await feeds.ensureHistory('btc', '1D')
await feeds.ensureHistory('btc', '1Y')

console.log('\n── Taux (unités par euro) ──')
if (seen.rates) {
  for (const c of CURRENCY_ORDER) console.log(`  ${c.padEnd(4)} ${String(seen.rates.perEur[c] ?? '—').padStart(12)}   démo ${DEMO_PER_EUR[c]}`)
  console.log(`  ${seen.rates.provider}, ${seen.rates.updatedAt}`)
} else console.log('  aucune lecture')

console.log('\n── Cours ──')
for (const { updates, source } of seen.prices) {
  for (const u of updates) {
    const d = demo.get(u.id)
    const local = u.local !== undefined ? `  (${u.local} ${u.currency})` : ''
    console.log(`  ${u.id.padEnd(10)} ${xof(u.price).padStart(22)}  ${(u.change24hPct >= 0 ? '+' : '') + u.change24hPct.toFixed(2)} %${local}   démo ${d ? xof(d.price) : '—'}   ${source.provider}`)
  }
}
if (seen.prices.length === 0) console.log('  aucune lecture')

console.log('\n── Historiques ──')
for (const s of seen.series) console.log(`  ${s.id} ${s.range}: ${s.n} points, ${new Date(s.first.t).toISOString()} → ${new Date(s.last.t).toISOString()}, dernier ${xof(s.last.p)}`)
if (seen.series.length === 0) console.log('  aucune lecture')

console.log('\n── Sources ──')
for (const r of seen.sources) console.log(`  ${r.kind.padEnd(7)} ${r.status.padEnd(6)} ${r.provider ?? ''}  ${r.detail ?? ''}`)

await vite.close()
const live = seen.sources.filter((r) => r.status === 'live').length
process.exit(live > 0 ? 0 : 1)
