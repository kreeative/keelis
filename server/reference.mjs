/**
 * A reference back-end for `docs/API.md`.
 *
 * Everything else about the seam is asserted rather than demonstrated: the REST client is
 * unit-tested against a fake `fetch`, and a test keeps the document from drifting away from
 * it — but until this existed, nothing in the repository had ever spoken HTTP. « Connect a
 * back-end and it works » was a claim.
 *
 * It is deliberately **one implementation, two transports**: the routes below call the same
 * `mockApi` the browser uses when no back-end is configured, loaded through Vite so it can
 * keep its `@/` imports and its TypeScript. There is no second copy of the rules to drift —
 * the spread, the indivisible-share rounding, the operator fees and the conversion ledger
 * are computed in exactly one place.
 *
 * What it is **not** is a product. There is no database, no authentication beyond echoing a
 * token, and the state lives in memory and dies with the process. Its job is to let somebody
 * run the real application against real HTTP before writing the real thing:
 *
 *     node server/reference.mjs &
 *     VITE_API_URL=http://localhost:8787/v1 pnpm build && pnpm preview
 *
 * `e2e/against-server.mjs` does exactly that, and drives the money flows through it.
 *
 * **It is also where the real market figures come in.** `server/feeds/` reads CoinGecko for
 * the coins, ExchangeRate-API for the rate table and — given `EODHD_API_KEY` — EODHD for
 * the Lagos, Johannesburg and Nairobi listings, and writes them into the same in-memory
 * state the routes serve. Nothing in the browser talks to a provider: the CSP forbids it,
 * and a provider key in a `VITE_` variable is a key published to every visitor. What the
 * feeds do not cover stays a demonstration figure and stays labelled as one; `FEEDS=off`
 * turns them off, which the e2e walk does.
 */
import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { createFeeds } from './feeds/index.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const PREFIX = '/v1'

/* The mock persists a few things — the PIN, the card's frozen flag, the risk profile —
   through `localStorage`. On a server that is simply a Map, and it is the honest shape of
   what a real back-end would keep per user. */
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { mockApi, __setMarketPrices, __setMarketSeries, __setFxRates, __setMarketSources } = await vite.ssrLoadModule('/src/api/mock/mockApi.ts')
const { IDS } = await vite.ssrLoadModule('/src/api/mock/seed.ts')
const { CFA_PER_EUR, DEMO_PER_EUR } = await vite.ssrLoadModule('/src/lib/fx.ts')
const { CURRENCY_ORDER } = await vite.ssrLoadModule('/src/lib/currency.ts')

const feeds = createFeeds({
  hooks: { setPrices: __setMarketPrices, setSeries: __setMarketSeries, setRates: __setFxRates, setSources: __setMarketSources },
  xofPerEur: CFA_PER_EUR,
  demoPerEur: DEMO_PER_EUR,
  currencies: CURRENCY_ORDER,
})

/** `ApiError` carries a `code`; everything else is a 500 we did not anticipate. */
function statusFor(code) {
  switch (code) {
    case 'validation':
      return 422
    case 'insufficient_funds':
      return 409
    case 'unauthorized':
      return 401
    case 'not_found':
      return 404
    case 'rate_limited':
      return 429
    case 'frozen':
      return 409
    case 'offline':
    case 'network':
      return 503
    default:
      return 500
  }
}

/**
 * The route table, in the order `docs/API.md` lists it.
 *
 * `:id` matches one segment. No literal segment shares a position with a parameter — the
 * document explains why, and this table is what would break first if that rule were ever
 * relaxed.
 */
const routes = [
  ['GET', '/auth/session', () => mockApi.auth.getSession()],
  ['POST', '/auth/code', (_p, body) => mockApi.auth.requestCode(body.email)],
  ['POST', '/auth/verify', (_p, body) => mockApi.auth.verifyCode(body.email, body.code)],
  ['GET', '/auth/onboarding', () => mockApi.auth.getOnboarding()],
  ['PATCH', '/auth/onboarding', (_p, body) => mockApi.auth.saveOnboarding(body)],
  ['POST', '/auth/onboarding/document', (_p, body) => mockApi.auth.uploadIdentityDocument(body)],
  ['POST', '/auth/onboarding/complete', () => mockApi.auth.completeOnboarding()],
  ['POST', '/auth/pin', (_p, body) => mockApi.auth.setPin(body.pin)],
  ['POST', '/auth/pin/verify', (_p, body) => mockApi.auth.verifyPin(body.pin)],
  ['POST', '/auth/signout', () => mockApi.auth.signOut()],

  ['GET', '/accounts', () => mockApi.accounts.list()],
  ['GET', '/accounts/:id/details', (p) => mockApi.accounts.details(p.id)],
  ['GET', '/accounts/:id', (p) => mockApi.accounts.get(p.id)],
  ['GET', '/networth/history', (_p, _b, q) => mockApi.accounts.history(q.get('range') ?? '1M')],

  ['GET', '/transactions', (_p, _b, q) => mockApi.transactions.list(filterFrom(q))],
  ['GET', '/transactions/:id', (p) => mockApi.transactions.get(p.id)],
  ['POST', '/transactions/:id/report', (p, body) => mockApi.transactions.report(p.id, body.reason)],
  ['POST', '/transactions/:id/receipt', (p) => mockApi.transactions.requestReceipt(p.id)],

  ['GET', '/card', () => mockApi.card.get()],
  ['PATCH', '/card', (_p, body) => mockApi.card.setFrozen(body.frozen)],
  ['POST', '/card/reveal', () => mockApi.card.reveal()],

  ['GET', '/assets', () => mockApi.crypto.listAssets()],
  /* A chart asks, the feed fetches (or serves what it fetched a moment ago), then the mock
     answers from the series the feed wrote in — or generates one, for what is not covered. */
  ['GET', '/assets/:id/history', async (p, _b, q) => {
    const range = q.get('range') ?? '1D'
    await feeds.ensureHistory(p.id, range)
    return mockApi.crypto.history(p.id, range)
  }],
  ['GET', '/assets/:id/address', (p, _b, q) => mockApi.crypto.receiveAddress(p.id, q.get('network'))],
  ['PATCH', '/assets/:id/watch', (p, body) => mockApi.crypto.setWatched(p.id, body.watched)],
  ['GET', '/assets/:id', (p) => mockApi.crypto.getAsset(p.id)],
  ['GET', '/portfolio/holdings', () => mockApi.crypto.holdings()],
  ['GET', '/portfolio/history', (_p, _b, q) => mockApi.crypto.portfolioHistory(q.get('range') ?? '1M')],
  ['POST', '/quotes', (_p, body) => mockApi.crypto.quote(body)],
  ['POST', '/orders', (_p, body) => mockApi.crypto.placeOrder(body.quoteId)],
  ['GET', '/recurring', () => mockApi.crypto.recurring.list()],
  ['POST', '/recurring', (_p, body) => mockApi.crypto.recurring.create(body)],
  ['PATCH', '/recurring/:id', (p, body) => mockApi.crypto.recurring.update(p.id, body)],
  ['DELETE', '/recurring/:id', (p) => mockApi.crypto.recurring.remove(p.id)],
  ['POST', '/crypto/withdrawals/preview', (_p, body) => mockApi.crypto.previewSend(body)],
  ['POST', '/crypto/withdrawals', (_p, body) => mockApi.crypto.send(body)],

  ['GET', '/savings/history', (_p, _b, q) => mockApi.savings.history(q.get('range') ?? '1M')],
  ['GET', '/savings/goals', () => mockApi.savings.goals.list()],
  ['POST', '/savings/goals', (_p, body) => mockApi.savings.goals.create(body)],
  ['POST', '/savings/goals/:id/contribute', (p, body) => mockApi.savings.goals.contribute(p.id, body.amount)],
  ['PATCH', '/savings/goals/:id', (p, body) => mockApi.savings.goals.update(p.id, body)],
  ['DELETE', '/savings/goals/:id', (p) => mockApi.savings.goals.remove(p.id)],
  ['POST', '/savings/deposit', (_p, body) => mockApi.savings.deposit(body.amount, body.fromAccountId)],
  ['POST', '/savings/withdraw', (_p, body) => mockApi.savings.withdraw(body.amount, body.toAccountId)],
  ['GET', '/savings', () => mockApi.savings.summary()],

  ['GET', '/fx/rates', () => mockApi.fx.rates()],
  ['POST', '/fx/conversions', (_p, body) => mockApi.fx.convert(body)],

  ['GET', '/market/sources', () => mockApi.market.sources()],

  ['GET', '/funding/sources', () => mockApi.funding.sources()],
  ['POST', '/funding', (_p, body) => mockApi.funding.addFunds(body)],
  ['POST', '/transfers', (_p, body) => mockApi.transfers.send(body)],
  ['GET', '/transfer-providers', () => mockApi.transfers.providers()],

  ['GET', '/notifications/prefs', () => mockApi.notifications.prefs()],
  ['PATCH', '/notifications/prefs', (_p, body) => mockApi.notifications.setPrefs(body)],
  ['POST', '/notifications/:id/read', (p) => mockApi.notifications.markRead(p.id)],
  ['PATCH', '/notifications', () => mockApi.notifications.markAllRead()],
  ['GET', '/notifications', () => mockApi.notifications.list()],

  ['GET', '/learn/papos', () => mockApi.learn.papos()],

  ['GET', '/me/security', () => mockApi.profile.security()],
  ['PATCH', '/me/security', (_p, body) => mockApi.profile.setSecurity(body)],
  ['GET', '/me/devices', () => mockApi.profile.devices()],
  ['DELETE', '/me/devices/:id', (p) => mockApi.profile.revokeDevice(p.id)],
  ['GET', '/me/statements', () => mockApi.profile.statements()],
  ['GET', '/me/tax-documents', () => mockApi.profile.taxDocuments()],
  ['GET', '/me/risk', () => mockApi.profile.risk()],
  ['PATCH', '/me/risk', (_p, body) => mockApi.profile.setRisk(body.answers)],
  ['GET', '/me', () => mockApi.profile.me()],
  ['PATCH', '/me', (_p, body) => mockApi.profile.update(body)],
]

/** Comma-separated lists come back as arrays; absent keys stay absent, never empty. */
function filterFrom(q) {
  const list = (k) => (q.get(k) ? q.get(k).split(',') : undefined)
  const num = (k) => (q.get(k) !== null ? Number(q.get(k)) : undefined)
  const filter = {
    accountId: q.get('accountId') ?? undefined,
    types: list('types'),
    categories: list('categories'),
    status: list('status'),
    minAmount: num('minAmount'),
    maxAmount: num('maxAmount'),
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
    query: q.get('q') ?? undefined,
    limit: num('limit'),
  }
  for (const k of Object.keys(filter)) if (filter[k] === undefined) delete filter[k]
  return Object.keys(filter).length ? filter : undefined
}

function match(method, pathname) {
  const parts = pathname.split('/').filter(Boolean)
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue
    const want = pattern.split('/').filter(Boolean)
    if (want.length !== parts.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < want.length; i += 1) {
      if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(parts[i])
      else if (want[i] !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { handler, params }
  }
  return null
}

/* CORS, and the one rule a wildcard breaks. `/events` is an `EventSource`, which cannot
   set an `Authorization` header — so it is opened with `withCredentials`, and a browser
   refuses a credentialed response whose `Access-Control-Allow-Origin` is `*`. The stream
   then dies before the first frame and the app quietly falls back to polling: state still
   moves, so nothing looks broken, and every settlement arrives seconds late for the rest of
   the session. Echo the caller's origin instead, and say so with `Vary`. A real deployment
   pins `ALLOW_ORIGIN` to its own app rather than echoing. */
function cors(req) {
  const allowed = process.env.ALLOW_ORIGIN
  const origin = allowed ?? req.headers.origin ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    ...(allowed ? {} : { Vary: 'Origin' }),
  }
}

const server = createHttpServer(async (req, res) => {
  const CORS = cors(req)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  if (!url.pathname.startsWith(PREFIX)) {
    res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'Chemin inconnu.' } }))
    return
  }
  const path = url.pathname.slice(PREFIX.length) || '/'

  /* Server-sent events: the stream that turns « En attente » into a settled transaction
     without the user refreshing. */
  if (path === '/events') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    const off = mockApi.subscribe((event) => res.write(`data: ${JSON.stringify(event)}\n\n`))
    const beat = setInterval(() => res.write(': keep-alive\n\n'), 20_000)
    req.on('close', () => {
      clearInterval(beat)
      off()
    })
    return
  }

  const route = match(req.method, path)
  if (!route) {
    res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'not_found', message: `${req.method} ${path} n’existe pas.` } }))
    return
  }

  let body = {}
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (raw) {
      try {
        body = JSON.parse(raw)
      } catch {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { code: 'validation', message: 'Corps JSON invalide.' } }))
        return
      }
    }
  }

  try {
    const result = await route.handler(route.params, body, url.searchParams)
    if (result === undefined) {
      res.writeHead(204, CORS)
      res.end()
      return
    }
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    const code = error?.code ?? 'unknown'
    res.writeHead(statusFor(code), { ...CORS, 'Content-Type': 'application/json' })
    // The shape `docs/API.md` promises, and the shape `http.ts` reads.
    res.end(JSON.stringify({ error: { code, message: error?.message ?? 'Erreur', details: error?.details } }))
  }
})

server.listen(PORT, () => {
  console.log(`Reference back-end on http://localhost:${PORT}${PREFIX} — ${routes.length} endpoints, chequing account ${IDS.checking}`)
  /* After listen, not before: a provider that is slow to answer must not hold the port. */
  void feeds.start()
})
