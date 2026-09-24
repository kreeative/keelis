/**
 * `KeewalApi` over HTTP. This is what runs once `VITE_API_URL` points at a backend.
 *
 * It is written as a flat, boring mapping of contract method → endpoint on purpose: the
 * interesting decisions all live one layer down in `http.ts` (auth, timeouts, error codes)
 * or one layer up in the screens. Every endpoint this file calls is listed in
 * `docs/API.md`, which is the specification a backend has to satisfy — the file and the
 * document are meant to be read side by side, and neither may gain an endpoint alone.
 *
 * Two things are not plain calls, and both are about staying current without asking:
 *
 * - `subscribe` is server-sent events. A pending transaction settling is something the
 *   server knows first, and the whole « En attente » → « Réglée » behaviour depends on
 *   hearing it. If `EventSource` is missing or the stream drops, it falls back to polling,
 *   because a slightly late settlement is a nuisance and a never-settling one is a bug
 *   report.
 * - `subscribePrices` polls. A price socket per asset list is a backend decision, not a
 *   frontend one; when the backend offers a stream it will arrive through `subscribe`.
 *
 * **No literal path segment ever shares a position with a path parameter.** `/orders/quote`
 * beside a future `/orders/:id` is the classic router ambiguity: it works until someone
 * adds the second route, and then it depends on declaration order in a framework the
 * frontend cannot see. So quoting is `POST /quotes`, the net-worth curve is
 * `/networth/history` rather than `/accounts/history`, sending crypto out is
 * `/crypto/withdrawals` rather than `/assets/send`, the rails are `/transfer-providers`,
 * and marking everything read is a `PATCH` on the collection. Every path here is
 * unambiguous whatever order a backend registers it in.
 */
import type {
  Account,
  AccountDetails,
  AddFundsRequest,
  ApiEvent,
  AppNotification,
  Card,
  CardSecrets,
  ChartRange,
  CryptoAsset,
  CryptoSendPreview,
  CryptoSendRequest,
  Device,
  FundingSource,
  FxConvertRequest,
  FxRates,
  GoalInput,
  Holding,
  KeewalApi,
  MarketSource,
  MoneyMovementResult,
  NotificationPrefs,
  Papo,
  OnboardingState,
  Order,
  PriceHistory,
  Quote,
  QuoteRequest,
  ReceiveAddress,
  RecurringBuy,
  RecurringFrequency,
  RiskProfile,
  SavingsGoal,
  SavingsSummary,
  SecuritySettings,
  Session,
  Statement,
  TaxDocument,
  Transaction,
  TransactionFilter,
  TransferProvider,
  TransferRequest,
  Unsubscribe,
  User,
} from '../types'
import { createHttp, setToken, type HttpOptions } from './http'

/** How often prices are re-fetched. Matches the mock so the UI behaves identically. */
export const REST_PRICE_TICK_MS = 15_000
/** Fallback poll for server state when the event stream is unavailable. */
const EVENT_POLL_MS = 20_000

/** Filters go on the query string; only the set keys are sent. */
function transactionQuery(f?: TransactionFilter): Record<string, string | number | undefined> {
  if (!f) return {}
  return {
    accountId: f.accountId,
    types: f.types?.join(','),
    categories: f.categories?.join(','),
    status: f.status?.join(','),
    minAmount: f.minAmount,
    maxAmount: f.maxAmount,
    from: f.from,
    to: f.to,
    q: f.query,
    limit: f.limit,
  }
}

export function createRestApi(opts: HttpOptions): KeewalApi {
  const http = createHttp(opts)

  /**
   * One stream for the whole app, shared by every subscriber. Opening an EventSource per
   * screen would open five sockets to say the same thing.
   */
  const listeners = new Set<(e: ApiEvent) => void>()
  let source: EventSource | null = null
  let poll: ReturnType<typeof setInterval> | null = null

  function emit(event: ApiEvent) {
    for (const l of listeners) l(event)
  }

  function startPolling() {
    if (poll) return
    // Without a stream the app cannot know *what* changed, so it says "accounts" and lets
    // the query cache refetch. Coarser than an event, and still correct.
    poll = setInterval(() => emit({ type: 'accounts' }), EVENT_POLL_MS)
  }

  function openStream() {
    if (typeof EventSource === 'undefined') {
      startPolling()
      return
    }
    try {
      source = new EventSource(http.url('/events'), { withCredentials: true })
      source.onmessage = (m) => {
        try {
          emit(JSON.parse(m.data) as ApiEvent)
        } catch {
          /* a malformed frame is not worth taking the stream down for */
        }
      }
      source.onerror = () => {
        // EventSource reconnects on its own, but a backend that never serves /events would
        // retry forever in silence. Poll alongside it so state still moves.
        startPolling()
      }
    } catch {
      startPolling()
    }
  }

  function closeStream() {
    source?.close()
    source = null
    if (poll) clearInterval(poll)
    poll = null
  }

  return {
    auth: {
      getSession: () => http.get<Session | null>('/auth/session'),
      requestCode: (email) => http.post('/auth/code', { email }),
      async verifyCode(email, code) {
        const r = await http.post<{ ok: true; session?: Session }>('/auth/verify', { email, code })
        if (r.session) setToken(r.session.token)
        return r
      },
      getOnboarding: () => http.get<OnboardingState>('/auth/onboarding'),
      saveOnboarding: (patch) => http.patch<OnboardingState>('/auth/onboarding', patch),
      // Metadata only: the bytes go straight to the KYC vendor from a URL the backend
      // hands out, so a passport scan never passes through this app's own storage.
      uploadIdentityDocument: (file) => http.post('/auth/onboarding/document', file),
      async completeOnboarding() {
        const s = await http.post<Session>('/auth/onboarding/complete')
        setToken(s.token)
        return s
      },
      setPin: (pin) => http.post('/auth/pin', { pin }),
      verifyPin: (pin) => http.post('/auth/pin/verify', { pin }),
      async signOut() {
        try {
          await http.post('/auth/signout')
        } finally {
          // The local token goes whatever the server says: a failed sign-out that leaves
          // someone signed in is the wrong way to fail.
          setToken(null)
          closeStream()
        }
      },
    },

    accounts: {
      list: () => http.get<Account[]>('/accounts'),
      get: (id) => http.get<Account>(`/accounts/${encodeURIComponent(id)}`),
      details: (id) => http.get<AccountDetails>(`/accounts/${encodeURIComponent(id)}/details`),
      history: (range: ChartRange) => http.get<PriceHistory>('/networth/history', { range }),
    },

    transactions: {
      list: (filter) => http.get<Transaction[]>('/transactions', transactionQuery(filter)),
      get: (id) => http.get<Transaction>(`/transactions/${encodeURIComponent(id)}`),
      report: (id, reason) => http.post(`/transactions/${encodeURIComponent(id)}/report`, { reason }),
      requestReceipt: (id) => http.post(`/transactions/${encodeURIComponent(id)}/receipt`),
    },

    card: {
      get: () => http.get<Card>('/card'),
      setFrozen: (frozen) => http.patch<Card>('/card', { frozen }),
      // A separate endpoint, not a field on /card: the PAN and CVV should be fetched only
      // when someone asks to see them, and logged when they are.
      reveal: () => http.post<CardSecrets>('/card/reveal'),
    },

    crypto: {
      listAssets: () => http.get<CryptoAsset[]>('/assets'),
      getAsset: (id) => http.get<CryptoAsset>(`/assets/${encodeURIComponent(id)}`),
      setWatched: (id, watched) => http.patch<CryptoAsset>(`/assets/${encodeURIComponent(id)}/watch`, { watched }),
      history: (id, range) => http.get<PriceHistory>(`/assets/${encodeURIComponent(id)}/history`, { range }),
      portfolioHistory: (range) => http.get<PriceHistory>('/portfolio/history', { range }),
      holdings: () => http.get<Holding[]>('/portfolio/holdings'),
      quote: (req: QuoteRequest) => http.post<Quote>('/quotes', req),
      placeOrder: (quoteId) => http.post<Order>('/orders', { quoteId }),
      recurring: {
        list: () => http.get<RecurringBuy[]>('/recurring'),
        create: (input: { assetId: string; amount: number; frequency: RecurringFrequency }) => http.post<RecurringBuy>('/recurring', input),
        update: (id, patch) => http.patch<RecurringBuy>(`/recurring/${encodeURIComponent(id)}`, patch),
        remove: (id) => http.del<void>(`/recurring/${encodeURIComponent(id)}`),
      },
      receiveAddress: (assetId, networkId) => http.get<ReceiveAddress>(`/assets/${encodeURIComponent(assetId)}/address`, { network: networkId }),
      previewSend: (req: CryptoSendRequest) => http.post<CryptoSendPreview>('/crypto/withdrawals/preview', req),
      send: (req: CryptoSendRequest) => http.post<MoneyMovementResult>('/crypto/withdrawals', req),
      subscribePrices(listener) {
        let alive = true
        const tick = () => {
          http
            .get<CryptoAsset[]>('/assets')
            .then((assets) => alive && listener(assets))
            .catch(() => {
              /* a missed tick is not an error the user needs: the last price stays on screen */
            })
        }
        const id = setInterval(tick, REST_PRICE_TICK_MS)
        return () => {
          alive = false
          clearInterval(id)
        }
      },
    },

    savings: {
      summary: () => http.get<SavingsSummary>('/savings'),
      history: (range) => http.get<PriceHistory>('/savings/history', { range }),
      deposit: (amount, fromAccountId) => http.post<MoneyMovementResult>('/savings/deposit', { amount, fromAccountId }),
      withdraw: (amount, toAccountId) => http.post<MoneyMovementResult>('/savings/withdraw', { amount, toAccountId }),
      goals: {
        list: () => http.get<SavingsGoal[]>('/savings/goals'),
        create: (input: GoalInput) => http.post<SavingsGoal>('/savings/goals', input),
        update: (id, patch) => http.patch<SavingsGoal>(`/savings/goals/${encodeURIComponent(id)}`, patch),
        contribute: (id, amount) => http.post<SavingsGoal>(`/savings/goals/${encodeURIComponent(id)}/contribute`, { amount }),
        remove: (id) => http.del<void>(`/savings/goals/${encodeURIComponent(id)}`),
      },
    },

    fx: {
      rates: () => http.get<FxRates>('/fx/rates'),
      convert: (req: FxConvertRequest) => http.post<MoneyMovementResult>('/fx/conversions', req),
    },

    market: {
      sources: () => http.get<MarketSource[]>('/market/sources'),
    },

    funding: {
      sources: () => http.get<FundingSource[]>('/funding/sources'),
      addFunds: (req: AddFundsRequest) => http.post<MoneyMovementResult>('/funding', req),
    },

    transfers: {
      send: (req: TransferRequest) => http.post<MoneyMovementResult>('/transfers', req),
      providers: () => http.get<TransferProvider[]>('/transfer-providers'),
    },

    notifications: {
      list: () => http.get<AppNotification[]>('/notifications'),
      markRead: (id) => http.post<void>(`/notifications/${encodeURIComponent(id)}/read`),
      markAllRead: () => http.patch<void>('/notifications', { read: true }),
      prefs: () => http.get<NotificationPrefs>('/notifications/prefs'),
      setPrefs: (prefs: NotificationPrefs) => http.patch<NotificationPrefs>('/notifications/prefs', prefs),
    },

    learn: {
      papos: () => http.get<Papo[]>('/learn/papos'),
    },

    profile: {
      me: () => http.get<User>('/me'),
      update: (patch) => http.patch<User>('/me', patch),
      security: () => http.get<SecuritySettings>('/me/security'),
      setSecurity: (patch) => http.patch<SecuritySettings>('/me/security', patch),
      devices: () => http.get<Device[]>('/me/devices'),
      revokeDevice: (id) => http.del<void>(`/me/devices/${encodeURIComponent(id)}`),
      statements: () => http.get<Statement[]>('/me/statements'),
      taxDocuments: () => http.get<TaxDocument[]>('/me/tax-documents'),
      risk: () => http.get<RiskProfile | null>('/me/risk'),
      setRisk: (answers: Record<string, string>) => http.patch<RiskProfile>('/me/risk', { answers }),
    },

    subscribe(listener): Unsubscribe {
      listeners.add(listener)
      if (listeners.size === 1) openStream()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) closeStream()
      }
    },
  }
}
