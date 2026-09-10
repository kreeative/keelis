/**
 * In-memory implementation of KaalisApi.
 * - simulated latency (250–600 ms)
 * - offline + forced-failure controls for testing error states
 * - price ticker every 10 s (random walk)
 * - optimistic money movements: created as "pending", settle a few seconds later
 */
import { createPrng } from '@/lib/prng'
import { readJson, remove, writeJson } from '@/lib/storage'
import {
  ApiError,
  type Account,
  type AccountDetails,
  type ApiEvent,
  type AppNotification,
  type Card,
  type ChartRange,
  type CryptoAsset,
  type CryptoSendRequest,
  type Holding,
  type KaalisApi,
  type OnboardingState,
  type Order,
  type PriceHistory,
  type PricePoint,
  type Quote,
  type QuoteRequest,
  type RecurringBuy,
  type SavingsGoal,
  type SecuritySettings,
  type Session,
  type Transaction,
  type Unsubscribe,
  type User,
  type NotificationPrefs,
} from '../types'
import {
  IDS,
  NOW,
  SAVINGS_APY,
  makeAccounts,
  makeTransactions,
  seedAccountDetails,
  seedAssets,
  seedBalances,
  seedCard,
  seedDevices,
  seedFundingSources,
  seedGoals,
  seedHoldingsRaw,
  seedNotifications,
  seedRecurring,
  seedStatements,
  seedTaxDocuments,
  seedUser,
} from './seed'

const KEYS = {
  session: 'kaalis.session',
  onboarding: 'kaalis.onboarding',
  pin: 'kaalis.pin',
  security: 'kaalis.security',
  prefs: 'kaalis.notifprefs',
  watched: 'kaalis.watched',
  frozen: 'kaalis.card.frozen',
  locale: 'kaalis.locale',
}

export const PRICE_TICK_MS = 10_000
export const DEMO_CODE = '246810'

// ---------- controls (exposed for tests / dev tools) ----------
export const mockControls = {
  offline: false,
  failNext: 0,
  latency: [250, 600] as [number, number],
  settleMs: 2_500,
  /** Freeze the ticker (tests) */
  tickerEnabled: true,
}

async function simulate() {
  const [min, max] = mockControls.latency
  const ms = min + Math.random() * (max - min)
  await new Promise((r) => setTimeout(r, ms))
  const offline = mockControls.offline || (typeof navigator !== 'undefined' && navigator.onLine === false)
  if (offline) throw new ApiError('Vous êtes hors ligne.', 'offline')
  if (mockControls.failNext > 0) {
    mockControls.failNext -= 1
    throw new ApiError('Impossible de joindre Kaalis. Réessayez.', 'network')
  }
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// ---------- state ----------

class MockState {
  user: User = { ...seedUser }
  card: Card = { ...seedCard, frozen: readJson<boolean>(KEYS.frozen, false) }
  assets: CryptoAsset[] = seedAssets.map((a) => ({ ...a, sparkline: [...a.sparkline] }))
  holdings = seedHoldingsRaw.map((h) => ({ ...h }))
  transactions: Transaction[] = makeTransactions()
  goals: SavingsGoal[] = seedGoals.map((g) => ({ ...g }))
  recurring: RecurringBuy[] = seedRecurring.map((r) => ({ ...r }))
  notifications: AppNotification[] = seedNotifications.map((n) => ({ ...n }))
  balances = { ...seedBalances }
  interestThisMonth = 41.88
  interestAllTime = 118.75
  devices = seedDevices.map((d) => ({ ...d }))
  listeners = new Set<(e: ApiEvent) => void>()
  priceListeners = new Set<(a: CryptoAsset[]) => void>()
  tickerHandle: ReturnType<typeof setInterval> | null = null
  tick = 0

  constructor() {
    const watched = readJson<Record<string, boolean> | null>(KEYS.watched, null)
    if (watched) for (const a of this.assets) if (a.id in watched) a.watched = !!watched[a.id]
  }

  emit(e: ApiEvent) {
    for (const l of this.listeners) l(e)
  }

  asset(id: string): CryptoAsset {
    const a = this.assets.find((x) => x.id === id)
    if (!a) throw new ApiError('Actif introuvable.', 'not_found')
    return a
  }

  holdingsView(): Holding[] {
    return this.holdings
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const a = this.asset(h.assetId)
        const value = h.quantity * a.price
        const cost = h.quantity * h.avgCost
        return { assetId: h.assetId, symbol: a.symbol, quantity: h.quantity, avgCost: h.avgCost, value, pnl: value - cost, pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 }
      })
      .sort((a, b) => b.value - a.value)
  }

  cryptoValue() {
    return this.holdingsView().reduce((s, h) => s + h.value, 0)
  }

  cryptoChange24h() {
    let change = 0
    for (const h of this.holdings) {
      const a = this.asset(h.assetId)
      change += h.quantity * a.change24h
    }
    const value = this.cryptoValue()
    const prev = value - change
    return { change, pct: prev > 0 ? (change / prev) * 100 : 0 }
  }

  cryptoSparkline(): number[] {
    const n = 24
    const out: number[] = new Array(n).fill(0)
    for (const h of this.holdings) {
      const a = this.asset(h.assetId)
      for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) + h.quantity * (a.sparkline[i] ?? a.price)
    }
    return out
  }

  accounts(): Account[] {
    const { change, pct } = this.cryptoChange24h()
    return makeAccounts(this.cryptoValue(), change, pct, this.cryptoSparkline(), this.balances)
  }

  /** Random-walk price tick */
  advancePrices() {
    this.tick += 1
    const rng = createPrng(0xabc123 + this.tick)
    for (const a of this.assets) {
      const base24h = a.price / (1 + a.change24hPct / 100)
      const next = a.price * (1 + rng.range(-0.004, 0.004))
      a.price = next
      a.change24h = a.price - base24h
      a.change24hPct = ((a.price - base24h) / base24h) * 100
      a.sparkline = [...a.sparkline.slice(1), a.price]
    }
    for (const l of this.priceListeners) l(this.assets.map((a) => ({ ...a, sparkline: [...a.sparkline] })))
    this.emit({ type: 'accounts' })
  }

  startTicker() {
    if (this.tickerHandle || typeof window === 'undefined') return
    this.tickerHandle = setInterval(() => {
      if (mockControls.tickerEnabled) this.advancePrices()
    }, PRICE_TICK_MS)
  }

  stopTicker() {
    if (this.tickerHandle) clearInterval(this.tickerHandle)
    this.tickerHandle = null
  }

  addTransaction(t: Omit<Transaction, 'id' | 'currency'>): Transaction {
    const tx: Transaction = { id: uid('tx'), currency: 'CAD', ...t }
    this.transactions.unshift(tx)
    this.emit({ type: 'transaction', transaction: tx })
    return tx
  }

  settle(txId: string, after = mockControls.settleMs, status: Transaction['status'] = 'posted') {
    setTimeout(() => {
      const tx = this.transactions.find((t) => t.id === txId)
      if (!tx || tx.status !== 'pending') return
      tx.status = status
      tx.postedAt = new Date().toISOString()
      this.emit({ type: 'transaction', transaction: { ...tx } })
      this.emit({ type: 'accounts' })
    }, after)
  }

  notify(n: Omit<AppNotification, 'id' | 'date' | 'read'>) {
    const notification: AppNotification = { id: uid('ntf'), date: new Date().toISOString(), read: false, ...n }
    this.notifications.unshift(notification)
    this.emit({ type: 'notification', notification })
  }
}

const state = new MockState()

// ---------- history generation ----------

const RANGE_CONFIG: Record<ChartRange, { points: number; stepMs: number; vol: number }> = {
  '1D': { points: 96, stepMs: 15 * 60_000, vol: 0.0035 },
  '1W': { points: 168, stepMs: 60 * 60_000, vol: 0.006 },
  '1M': { points: 120, stepMs: 6 * 60 * 60_000, vol: 0.012 },
  '1Y': { points: 365, stepMs: 24 * 60 * 60_000, vol: 0.028 },
  MAX: { points: 520, stepMs: 7 * 24 * 60 * 60_000, vol: 0.06 },
}

function generateHistory(seedKey: number, endPrice: number, range: ChartRange, drift: number): PriceHistory['points'] {
  const cfg = RANGE_CONFIG[range]
  const rng = createPrng(seedKey)
  const n = cfg.points
  // Walk backwards from the end price
  const pts: PricePoint[] = new Array(n)
  let p = endPrice
  const end = NOW.getTime()
  pts[n - 1] = { t: end, p }
  for (let i = n - 2; i >= 0; i--) {
    p = p / (1 + drift / n + rng.range(-cfg.vol, cfg.vol))
    if (p < endPrice * 0.02) p = endPrice * 0.02
    pts[i] = { t: end - (n - 1 - i) * cfg.stepMs, p }
  }
  return pts
}

function withChange(assetId: string, range: ChartRange, points: PricePoint[]): PriceHistory {
  const first = points[0]?.p ?? 0
  const last = points[points.length - 1]?.p ?? 0
  return { assetId, range, points, change: last - first, changePct: first > 0 ? ((last - first) / first) * 100 : 0 }
}

// ---------- auth helpers ----------

function readSession(): Session | null {
  const s = readJson<Session | null>(KEYS.session, null)
  if (!s) return null
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    remove(KEYS.session)
    return null
  }
  return s
}

function openSession(user: User): Session {
  const session: Session = { user, token: uid('tok'), expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }
  writeJson(KEYS.session, session)
  return session
}

const defaultSecurity: SecuritySettings = { twoFactorEnabled: true, biometricsEnabled: false, pinSet: false, sessionTimeoutMinutes: 10 }

// ---------- the API ----------

export const mockApi: KaalisApi = {
  auth: {
    async getSession() {
      await simulate()
      const s = readSession()
      if (s) {
        state.user = { ...state.user, ...s.user }
        state.startTicker()
      }
      return s
    },
    async requestCode(email) {
      await simulate()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('Adresse courriel invalide.', 'validation', { email: 'Entrez une adresse courriel valide.' })
      const ob = readJson<OnboardingState>(KEYS.onboarding, { step: 'email' })
      writeJson(KEYS.onboarding, { ...ob, email, step: 'code' })
      return { sent: true, devHint: DEMO_CODE }
    },
    async verifyCode(email, code) {
      await simulate()
      if (code !== DEMO_CODE) throw new ApiError('Code incorrect.', 'validation', { code: 'Ce code ne correspond pas. Vérifiez votre courriel.' })
      const isExisting = email.trim().toLowerCase() === seedUser.email
      if (isExisting) {
        const session = openSession({ ...seedUser })
        remove(KEYS.onboarding)
        state.startTicker()
        return { ok: true, session }
      }
      const ob = readJson<OnboardingState>(KEYS.onboarding, { step: 'email', email })
      writeJson(KEYS.onboarding, { ...ob, email, step: 'identity' })
      return { ok: true }
    },
    async getOnboarding() {
      await simulate()
      return readJson<OnboardingState>(KEYS.onboarding, { step: 'email' })
    },
    async saveOnboarding(patch) {
      await simulate()
      const ob = readJson<OnboardingState>(KEYS.onboarding, { step: 'email' })
      const next = { ...ob, ...patch }
      writeJson(KEYS.onboarding, next)
      return next
    },
    async uploadIdentityDocument(file) {
      await simulate()
      await new Promise((r) => setTimeout(r, 900))
      if (file.size > 15 * 1024 * 1024) throw new ApiError('Fichier trop volumineux (max 15 Mo).', 'validation', { file: 'Le fichier dépasse 15 Mo.' })
      if (!/^(image\/|application\/pdf)/.test(file.type)) throw new ApiError('Format non pris en charge.', 'validation', { file: 'Utilisez une photo (JPG, PNG, HEIC) ou un PDF.' })
      const ob = readJson<OnboardingState>(KEYS.onboarding, { step: 'document' })
      writeJson(KEYS.onboarding, { ...ob, documentUploaded: true, step: 'twofactor' })
      return { ok: true }
    },
    async completeOnboarding() {
      await simulate()
      const ob = readJson<OnboardingState>(KEYS.onboarding, { step: 'email' })
      const user: User = {
        ...seedUser,
        id: uid('usr'),
        firstName: ob.firstName || seedUser.firstName,
        lastName: ob.lastName || seedUser.lastName,
        email: ob.email || seedUser.email,
        dateOfBirth: ob.dateOfBirth || seedUser.dateOfBirth,
        address: ob.address || seedUser.address,
        twoFactorEnabled: !!ob.twoFactorEnabled,
        verified: !!ob.documentUploaded,
        createdAt: new Date().toISOString(),
      }
      state.user = user
      const session = openSession(user)
      writeJson(KEYS.onboarding, { ...ob, step: 'done' })
      state.startTicker()
      return session
    },
    async setPin(pin) {
      await simulate()
      if (!/^\d{4,6}$/.test(pin)) throw new ApiError('Le NIP doit contenir 4 à 6 chiffres.', 'validation')
      writeJson(KEYS.pin, pin)
      const sec = readJson<SecuritySettings>(KEYS.security, defaultSecurity)
      writeJson(KEYS.security, { ...sec, pinSet: true })
      return { ok: true }
    },
    async verifyPin(pin) {
      await new Promise((r) => setTimeout(r, 200))
      const stored = readJson<string | null>(KEYS.pin, null)
      return { ok: stored === null ? pin === '1234' : stored === pin }
    },
    async signOut() {
      await simulate()
      remove(KEYS.session)
      state.stopTicker()
    },
  },

  accounts: {
    async list() {
      await simulate()
      return state.accounts()
    },
    async get(id) {
      await simulate()
      const a = state.accounts().find((x) => x.id === id)
      if (!a) throw new ApiError('Compte introuvable.', 'not_found')
      return a
    },
    async details(id) {
      await simulate()
      if (id !== IDS.checking && id !== IDS.savings) throw new ApiError('Compte introuvable.', 'not_found')
      const acct = id === IDS.checking ? seedAccountDetails.accountNumber : '4001 8827 9'
      return { ...seedAccountDetails, accountId: id, accountNumber: acct, holderName: `${state.user.firstName} ${state.user.lastName}` } as AccountDetails
    },
  },

  transactions: {
    async list(filter = {}) {
      await simulate()
      let list = state.transactions.slice()
      if (filter.accountId) list = list.filter((t) => t.accountId === filter.accountId)
      if (filter.types?.length) list = list.filter((t) => filter.types!.includes(t.type))
      if (filter.categories?.length) list = list.filter((t) => filter.categories!.includes(t.category))
      if (filter.status?.length) list = list.filter((t) => filter.status!.includes(t.status))
      if (filter.minAmount !== undefined) list = list.filter((t) => Math.abs(t.amount) >= filter.minAmount!)
      if (filter.maxAmount !== undefined) list = list.filter((t) => Math.abs(t.amount) <= filter.maxAmount!)
      if (filter.from) list = list.filter((t) => t.date >= filter.from!)
      if (filter.to) list = list.filter((t) => t.date <= filter.to!)
      if (filter.query) {
        const q = filter.query.trim().toLowerCase()
        list = list.filter((t) => t.counterparty.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q) || String(Math.abs(t.amount)).includes(q))
      }
      if (filter.limit) list = list.slice(0, filter.limit)
      return list
    },
    async get(id) {
      await simulate()
      const t = state.transactions.find((x) => x.id === id)
      if (!t) throw new ApiError('Transaction introuvable.', 'not_found')
      return { ...t }
    },
    async report(id, reason) {
      await simulate()
      const t = state.transactions.find((x) => x.id === id)
      if (!t) throw new ApiError('Transaction introuvable.', 'not_found')
      const caseId = `DOS-${Math.floor(100000 + Math.random() * 900000)}`
      state.notify({ kind: 'security', title: 'Signalement reçu', body: `Dossier ${caseId} ouvert pour ${t.counterparty}. Motif : ${reason}. Réponse sous 2 jours ouvrables.`, link: '/carte' })
      return { caseId }
    },
    async requestReceipt(id) {
      await simulate()
      const t = state.transactions.find((x) => x.id === id)
      if (!t) throw new ApiError('Transaction introuvable.', 'not_found')
      return { sentTo: state.user.email }
    },
  },

  card: {
    async get() {
      await simulate()
      return { ...state.card }
    },
    async setFrozen(frozen) {
      await simulate()
      state.card = { ...state.card, frozen }
      writeJson(KEYS.frozen, frozen)
      state.emit({ type: 'card', card: state.card })
      state.notify({ kind: 'security', title: frozen ? 'Carte gelée' : 'Carte réactivée', body: frozen ? 'Les paiements sont bloqués jusqu’à la réactivation.' : 'Votre carte accepte de nouveau les paiements.', link: '/carte' })
      return { ...state.card }
    },
    async reveal() {
      await simulate()
      await new Promise((r) => setTimeout(r, 400))
      return { pan: `5412 7702 3391 ${state.card.last4}`, cvv: '318' }
    },
  },

  crypto: {
    async listAssets() {
      await simulate()
      return state.assets.map((a) => ({ ...a, sparkline: [...a.sparkline] }))
    },
    async getAsset(id) {
      await simulate()
      const a = state.asset(id)
      return { ...a, sparkline: [...a.sparkline] }
    },
    async setWatched(id, watched) {
      await simulate()
      const a = state.asset(id)
      a.watched = watched
      const map = readJson<Record<string, boolean>>(KEYS.watched, {})
      map[id] = watched
      writeJson(KEYS.watched, map)
      return { ...a }
    },
    async history(id, range) {
      await simulate()
      const a = state.asset(id)
      const idx = state.assets.indexOf(a)
      const driftByRange: Record<ChartRange, number> = { '1D': a.change24hPct / 100, '1W': 0.04, '1M': 0.11, '1Y': 0.9, MAX: 6 }
      const pts = generateHistory(7000 + idx * 31 + range.length, a.price, range, driftByRange[range])
      if (range === '1D') {
        // Keep 1D consistent with 24h change
        const first = a.price / (1 + a.change24hPct / 100)
        const f0 = pts[0]!.p
        const k = (a.price - first) / (a.price - f0 || 1)
        for (const p of pts) p.p = a.price - (a.price - p.p) * k
      }
      return withChange(id, range, pts)
    },
    async holdings() {
      await simulate()
      return state.holdingsView()
    },
    async quote(req: QuoteRequest) {
      await simulate()
      const a = state.asset(req.assetId)
      if (!(req.amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
      const market = a.price
      const spreadPct = a.spreadPct
      const exec = req.side === 'buy' ? market * (1 + spreadPct) : market * (1 - spreadPct)
      let quantity: number
      let total: number
      if (req.mode === 'fiat') {
        total = round2(req.amount)
        quantity = total / exec
      } else {
        quantity = req.amount
        total = round2(quantity * exec)
      }
      if (total < a.minTrade) throw new ApiError(`Montant minimum : ${a.minTrade} $`, 'validation')
      if (req.side === 'buy' && total > state.balances.checking) throw new ApiError('Solde insuffisant sur le compte Chèque.', 'insufficient_funds')
      if (req.side === 'sell') {
        const h = state.holdings.find((x) => x.assetId === a.id)
        if (!h || h.quantity + 1e-12 < quantity) throw new ApiError('Quantité supérieure à vos avoirs.', 'insufficient_funds')
      }
      const spreadAmount = round2(Math.abs(exec - market) * quantity)
      const quote: Quote = {
        id: uid('q'),
        assetId: a.id,
        symbol: a.symbol,
        side: req.side,
        marketPrice: market,
        executionPrice: exec,
        spreadPct,
        spreadAmount,
        fee: 0,
        quantity,
        subtotal: total,
        total,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      }
      quotes.set(quote.id, quote)
      return quote
    },
    async placeOrder(quoteId) {
      await simulate()
      const q = quotes.get(quoteId)
      if (!q) throw new ApiError('Cotation expirée. Recommencez.', 'validation')
      if (new Date(q.expiresAt).getTime() < Date.now()) {
        quotes.delete(quoteId)
        throw new ApiError('Cotation expirée. Recommencez.', 'validation')
      }
      quotes.delete(quoteId)
      const a = state.asset(q.assetId)
      const h = state.holdings.find((x) => x.assetId === q.assetId)
      if (q.side === 'buy') {
        if (q.total > state.balances.checking) throw new ApiError('Solde insuffisant sur le compte Chèque.', 'insufficient_funds')
        state.balances.checking = round2(state.balances.checking - q.total)
        if (h) {
          const cost = h.quantity * h.avgCost + q.total
          h.quantity += q.quantity
          h.avgCost = cost / h.quantity
        } else state.holdings.push({ assetId: q.assetId, quantity: q.quantity, avgCost: q.executionPrice })
      } else {
        if (!h || h.quantity + 1e-12 < q.quantity) throw new ApiError('Quantité supérieure à vos avoirs.', 'insufficient_funds')
        h.quantity = Math.max(0, h.quantity - q.quantity)
        state.balances.checking = round2(state.balances.checking + q.total)
      }
      const now = new Date().toISOString()
      const tx = state.addTransaction({
        accountId: IDS.crypto,
        type: q.side === 'buy' ? 'crypto_buy' : 'crypto_sell',
        status: 'pending',
        amount: q.side === 'buy' ? -q.total : q.total,
        counterparty: `${q.side === 'buy' ? 'Achat' : 'Vente'} ${a.symbol}`,
        category: 'crypto',
        date: now,
        channel: 'app',
        asset: { assetId: a.id, symbol: a.symbol, quantity: q.quantity, price: q.executionPrice },
      })
      const mirror = state.addTransaction({
        accountId: IDS.checking,
        type: q.side === 'buy' ? 'transfer_out' : 'transfer_in',
        status: 'pending',
        amount: q.side === 'buy' ? -q.total : q.total,
        counterparty: q.side === 'buy' ? 'Vers Crypto' : 'Depuis Crypto',
        category: 'crypto',
        date: now,
        channel: 'app',
      })
      state.emit({ type: 'accounts' })
      state.settle(tx.id)
      state.settle(mirror.id)
      const order: Order = { id: uid('ord'), quote: q, status: 'pending', transactionId: tx.id, createdAt: now }
      return order
    },
    recurring: {
      async list() {
        await simulate()
        return state.recurring.map((r) => ({ ...r }))
      },
      async create(input) {
        await simulate()
        const a = state.asset(input.assetId)
        if (!(input.amount >= 5)) throw new ApiError('Montant minimum : 5 $', 'validation')
        const daysUntil: Record<RecurringBuy['frequency'], number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }
        const r: RecurringBuy = { id: uid('rec'), assetId: a.id, symbol: a.symbol, amount: input.amount, frequency: input.frequency, nextRun: new Date(Date.now() + daysUntil[input.frequency] * 86_400_000).toISOString(), active: true, createdAt: new Date().toISOString() }
        state.recurring.push(r)
        state.emit({ type: 'recurring' })
        return { ...r }
      },
      async update(id, patch) {
        await simulate()
        const r = state.recurring.find((x) => x.id === id)
        if (!r) throw new ApiError('Achat récurrent introuvable.', 'not_found')
        Object.assign(r, patch)
        state.emit({ type: 'recurring' })
        return { ...r }
      },
      async remove(id) {
        await simulate()
        state.recurring = state.recurring.filter((x) => x.id !== id)
        state.emit({ type: 'recurring' })
      },
    },
    async receiveAddress(assetId, networkId) {
      await simulate()
      const a = state.asset(assetId)
      const net = a.networks.find((n) => n.id === networkId)
      if (!net) throw new ApiError('Réseau non pris en charge.', 'validation')
      const rng = createPrng(assetId.length * 7919 + networkId.length * 104729)
      const alphabet = net.addressPrefix.startsWith('0x') ? '0123456789abcdef' : '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      const len = net.addressPrefix.startsWith('0x') ? 40 : 38
      let body = ''
      for (let i = 0; i < len; i++) body += alphabet[Math.floor(rng.next() * alphabet.length)]
      const address = `${net.addressPrefix}${body}`
      return { assetId, networkId, address, qrPayload: `${a.symbol.toLowerCase()}:${address}` }
    },
    async previewSend(req: CryptoSendRequest) {
      await simulate()
      const a = state.asset(req.assetId)
      const net = a.networks.find((n) => n.id === req.networkId)
      if (!net) throw new ApiError('Réseau non pris en charge.', 'validation')
      if (!(req.quantity > 0)) throw new ApiError('Entrez une quantité.', 'validation')
      if (!req.address || req.address.length < 20) throw new ApiError('Adresse invalide.', 'validation', { address: 'Cette adresse semble incomplète.' })
      if (net.addressPrefix && !req.address.startsWith(net.addressPrefix)) throw new ApiError('Adresse incompatible avec ce réseau.', 'validation', { address: `Une adresse ${net.name} commence par « ${net.addressPrefix} ».` })
      const h = state.holdings.find((x) => x.assetId === a.id)
      const totalDebit = req.quantity + net.feeEstimate
      if (!h || h.quantity + 1e-12 < totalDebit) throw new ApiError('Avoirs insuffisants (frais réseau inclus).', 'insufficient_funds')
      return { quantity: req.quantity, networkFee: net.feeEstimate, totalDebit, fiatValue: req.quantity * a.price, etaMinutes: net.etaMinutes }
    },
    async send(req) {
      const preview = await mockApi.crypto.previewSend(req)
      const a = state.asset(req.assetId)
      const h = state.holdings.find((x) => x.assetId === a.id)!
      h.quantity = Math.max(0, h.quantity - preview.totalDebit)
      const tx = state.addTransaction({
        accountId: IDS.crypto,
        type: 'crypto_send',
        status: 'pending',
        amount: -preview.fiatValue,
        counterparty: `Envoi ${a.symbol} · ${req.address.slice(0, 6)}…${req.address.slice(-4)}`,
        category: 'crypto',
        date: new Date().toISOString(),
        channel: 'app',
        asset: { assetId: a.id, symbol: a.symbol, quantity: preview.totalDebit, price: a.price },
      })
      state.emit({ type: 'accounts' })
      state.settle(tx.id, Math.min(6_000, preview.etaMinutes * 1_000))
      return { transactionId: tx.id, status: 'pending', eta: `≈ ${preview.etaMinutes} min`, etaMinutes: preview.etaMinutes }
    },
    subscribePrices(listener): Unsubscribe {
      state.priceListeners.add(listener)
      state.startTicker()
      return () => state.priceListeners.delete(listener)
    },
  },

  savings: {
    async summary() {
      await simulate()
      const next = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1)
      return { accountId: IDS.savings, balance: state.balances.savings, apy: SAVINGS_APY, interestThisMonth: state.interestThisMonth, interestAllTime: state.interestAllTime, nextPayoutDate: next.toISOString() }
    },
    async history(range) {
      await simulate()
      const cfg = RANGE_CONFIG[range]
      const rng = createPrng(4242 + cfg.points)
      const end = NOW.getTime()
      const balance = state.balances.savings
      const dailyRate = SAVINGS_APY / 100 / 365
      const pts: PricePoint[] = []
      // Deposits of 650 roughly every 30 days; a 400 withdrawal 19 days ago
      for (let i = 0; i < cfg.points; i++) {
        const t = end - (cfg.points - 1 - i) * cfg.stepMs
        const daysBack = (end - t) / 86_400_000
        let v = balance
        v -= 650 * Math.floor(Math.max(0, daysBack - 3) / 30 + (daysBack >= 3 ? 1 : 0))
        if (daysBack >= 19) v += 400
        v = v / Math.pow(1 + dailyRate, daysBack)
        v += rng.range(-0.4, 0.4)
        pts.push({ t, p: Math.max(0, v) })
      }
      pts[pts.length - 1] = { t: end, p: balance }
      return withChange(IDS.savings, range, pts)
    },
    async deposit(amount, fromAccountId) {
      await simulate()
      if (!(amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
      if (fromAccountId !== IDS.checking) throw new ApiError('Compte source non pris en charge.', 'validation')
      if (amount > state.balances.checking) throw new ApiError('Solde insuffisant sur le compte Chèque.', 'insufficient_funds')
      state.balances.checking = round2(state.balances.checking - amount)
      state.balances.savings = round2(state.balances.savings + amount)
      const now = new Date().toISOString()
      const a = state.addTransaction({ accountId: IDS.savings, type: 'deposit', status: 'pending', amount, counterparty: 'Depuis Chèque', category: 'savings', date: now, channel: 'app' })
      const b = state.addTransaction({ accountId: IDS.checking, type: 'transfer_out', status: 'pending', amount: -amount, counterparty: 'Vers Épargne', category: 'savings', date: now, channel: 'app' })
      state.emit({ type: 'accounts' })
      state.settle(a.id, 1_500)
      state.settle(b.id, 1_500)
      return { transactionId: a.id, status: 'pending', eta: 'Instantané', etaMinutes: 0 }
    },
    async withdraw(amount, toAccountId) {
      await simulate()
      if (!(amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
      if (toAccountId !== IDS.checking) throw new ApiError('Compte destination non pris en charge.', 'validation')
      if (amount > state.balances.savings) throw new ApiError('Solde insuffisant sur le compte Épargne.', 'insufficient_funds')
      state.balances.savings = round2(state.balances.savings - amount)
      state.balances.checking = round2(state.balances.checking + amount)
      const now = new Date().toISOString()
      const a = state.addTransaction({ accountId: IDS.savings, type: 'withdrawal', status: 'pending', amount: -amount, counterparty: 'Vers Chèque', category: 'savings', date: now, channel: 'app' })
      const b = state.addTransaction({ accountId: IDS.checking, type: 'transfer_in', status: 'pending', amount, counterparty: 'Depuis Épargne', category: 'savings', date: now, channel: 'app' })
      state.emit({ type: 'accounts' })
      state.settle(a.id, 1_500)
      state.settle(b.id, 1_500)
      return { transactionId: a.id, status: 'pending', eta: 'Instantané', etaMinutes: 0 }
    },
    goals: {
      async list() {
        await simulate()
        return state.goals.map((g) => ({ ...g }))
      },
      async create(input) {
        await simulate()
        if (!input.name.trim()) throw new ApiError('Donnez un nom à votre objectif.', 'validation', { name: 'Requis.' })
        if (!(input.target > 0)) throw new ApiError('Montant cible invalide.', 'validation', { target: 'Entrez un montant supérieur à 0.' })
        const current = input.initialDeposit ?? 0
        const allocated = state.goals.reduce((s, g) => s + g.current, 0)
        if (allocated + current > state.balances.savings) throw new ApiError('Le dépôt initial dépasse le solde disponible de l’Épargne.', 'insufficient_funds')
        const g: SavingsGoal = { id: uid('goal'), name: input.name.trim(), target: input.target, current, monthlyContribution: input.monthlyContribution, createdAt: new Date().toISOString(), estimatedDate: estimateGoalDate(input.target, current, input.monthlyContribution) }
        state.goals.push(g)
        state.emit({ type: 'goals' })
        return { ...g }
      },
      async update(id, patch) {
        await simulate()
        const g = state.goals.find((x) => x.id === id)
        if (!g) throw new ApiError('Objectif introuvable.', 'not_found')
        if (patch.name !== undefined) g.name = patch.name
        if (patch.target !== undefined) g.target = patch.target
        if (patch.monthlyContribution !== undefined) g.monthlyContribution = patch.monthlyContribution
        g.estimatedDate = estimateGoalDate(g.target, g.current, g.monthlyContribution)
        state.emit({ type: 'goals' })
        return { ...g }
      },
      async contribute(id, amount) {
        await simulate()
        const g = state.goals.find((x) => x.id === id)
        if (!g) throw new ApiError('Objectif introuvable.', 'not_found')
        if (!(amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
        const allocated = state.goals.reduce((s, x) => s + x.current, 0)
        if (allocated + amount > state.balances.savings) throw new ApiError('Montant supérieur au solde non affecté de l’Épargne.', 'insufficient_funds')
        g.current = round2(g.current + amount)
        g.estimatedDate = estimateGoalDate(g.target, g.current, g.monthlyContribution)
        state.emit({ type: 'goals' })
        return { ...g }
      },
      async remove(id) {
        await simulate()
        state.goals = state.goals.filter((x) => x.id !== id)
        state.emit({ type: 'goals' })
      },
    },
  },

  funding: {
    async sources() {
      await simulate()
      return seedFundingSources.map((s) => ({ ...s }))
    },
    async addFunds(req) {
      await simulate()
      const src = seedFundingSources.find((s) => s.id === req.sourceId)
      if (!src) throw new ApiError('Source introuvable.', 'not_found')
      if (!(req.amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
      if (req.amount > src.limitPerDay) throw new ApiError(`Limite quotidienne : ${src.limitPerDay} $`, 'validation')
      const dest = req.destinationAccountId === IDS.savings ? 'savings' : 'checking'
      const fee = round2(req.amount * src.feePct)
      const net = round2(req.amount - fee)
      const instant = src.etaMinutes === 0
      const tx = state.addTransaction({ accountId: dest === 'savings' ? IDS.savings : IDS.checking, type: 'deposit', status: 'pending', amount: net, counterparty: `${src.label} · ${src.mask}`, category: 'transfer', date: new Date().toISOString(), channel: 'bank', note: instant ? undefined : `Arrivée prévue : ${src.eta}` })
      if (instant) {
        state.balances[dest] = round2(state.balances[dest] + net)
        state.emit({ type: 'accounts' })
        state.settle(tx.id, 2_000)
      } else {
        // Non-instant deposits settle later (demo: 8 s), then credit the balance.
        setTimeout(() => {
          const t = state.transactions.find((x) => x.id === tx.id)
          if (!t || t.status !== 'pending') return
          state.balances[dest] = round2(state.balances[dest] + net)
          t.status = 'posted'
          t.postedAt = new Date().toISOString()
          state.emit({ type: 'transaction', transaction: { ...t } })
          state.emit({ type: 'accounts' })
          state.notify({ kind: 'transaction', title: 'Fonds reçus', body: `${src.label} · dépôt crédité sur votre compte ${dest === 'savings' ? 'Épargne' : 'Chèque'}.`, link: dest === 'savings' ? '/epargne' : '/carte' })
        }, 8_000)
      }
      return { transactionId: tx.id, status: 'pending', eta: src.eta, etaMinutes: src.etaMinutes }
    },
  },

  transfers: {
    async send(req) {
      await simulate()
      if (!(req.amount > 0)) throw new ApiError('Entrez un montant.', 'validation')
      if (req.fromAccountId !== IDS.checking) throw new ApiError('Seul le compte Chèque peut envoyer.', 'validation')
      if (state.card.frozen && req.method !== 'internal') {
        // frozen card doesn't block transfers, but keep the code path explicit
      }
      if (req.amount > state.balances.checking) throw new ApiError('Solde insuffisant sur le compte Chèque.', 'insufficient_funds')
      if (req.method === 'internal') {
        if (req.toAccountId !== IDS.savings) throw new ApiError('Compte destination non pris en charge.', 'validation')
        return mockApi.savings.deposit(req.amount, IDS.checking)
      }
      if (!req.recipient?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.recipient.email)) throw new ApiError('Courriel du destinataire invalide.', 'validation', { email: 'Entrez une adresse courriel valide.' })
      state.balances.checking = round2(state.balances.checking - req.amount)
      const tx = state.addTransaction({ accountId: IDS.checking, type: req.method === 'wire' ? 'transfer_out' : 'etransfer_out', status: 'pending', amount: -req.amount, counterparty: req.recipient.name || req.recipient.email, category: 'transfer', date: new Date().toISOString(), channel: 'app', note: req.note })
      state.emit({ type: 'accounts' })
      state.settle(tx.id, req.method === 'wire' ? 6_000 : 3_000)
      return { transactionId: tx.id, status: 'pending', eta: req.method === 'wire' ? '1 à 2 jours ouvrables' : 'Quelques minutes', etaMinutes: req.method === 'wire' ? 1_440 : 15 }
    },
  },

  notifications: {
    async list() {
      await simulate()
      return state.notifications.map((n) => ({ ...n }))
    },
    async markRead(id) {
      await simulate()
      const n = state.notifications.find((x) => x.id === id)
      if (n) n.read = true
    },
    async markAllRead() {
      await simulate()
      for (const n of state.notifications) n.read = true
    },
    async prefs() {
      await simulate()
      return readJson<NotificationPrefs>(KEYS.prefs, { transactions: true, security: true, market: true, savings: true, marketing: false })
    },
    async setPrefs(prefs) {
      await simulate()
      writeJson(KEYS.prefs, prefs)
      return prefs
    },
  },

  profile: {
    async me() {
      await simulate()
      return { ...state.user }
    },
    async update(patch) {
      await simulate()
      state.user = { ...state.user, ...patch }
      const s = readSession()
      if (s) writeJson(KEYS.session, { ...s, user: state.user })
      if (patch.locale) writeJson(KEYS.locale, patch.locale)
      return { ...state.user }
    },
    async security() {
      await simulate()
      const sec = readJson<SecuritySettings>(KEYS.security, { ...defaultSecurity, twoFactorEnabled: state.user.twoFactorEnabled, biometricsEnabled: state.user.biometricsEnabled, pinSet: state.user.pinSet })
      return { ...sec, pinSet: readJson<string | null>(KEYS.pin, null) !== null || sec.pinSet }
    },
    async setSecurity(patch) {
      await simulate()
      const sec = await mockApi.profile.security()
      const next = { ...sec, ...patch }
      writeJson(KEYS.security, next)
      state.user = { ...state.user, twoFactorEnabled: next.twoFactorEnabled, biometricsEnabled: next.biometricsEnabled, pinSet: next.pinSet }
      return next
    },
    async devices() {
      await simulate()
      return state.devices.map((d) => ({ ...d }))
    },
    async revokeDevice(id) {
      await simulate()
      const d = state.devices.find((x) => x.id === id)
      if (d?.current) throw new ApiError('Impossible de révoquer l’appareil courant.', 'validation')
      state.devices = state.devices.filter((x) => x.id !== id)
    },
    async statements() {
      await simulate()
      return seedStatements.map((s) => ({ ...s }))
    },
    async taxDocuments() {
      await simulate()
      return seedTaxDocuments.map((t) => ({ ...t }))
    },
  },

  subscribe(listener) {
    state.listeners.add(listener)
    return () => state.listeners.delete(listener)
  },
}

const quotes = new Map<string, Quote>()

function estimateGoalDate(target: number, current: number, monthly: number): string {
  const remaining = Math.max(0, target - current)
  const months = monthly > 0 ? Math.ceil(remaining / monthly) : 120
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

/** Test/dev hook to advance the ticker manually */
export function __advancePrices() {
  state.advancePrices()
}
/** Test hook to reset in-memory state */
export function __resetMockState() {
  Object.assign(state, new MockState())
}
