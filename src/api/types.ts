/**
 * Keewal Meere API contract. The UI only talks to `KeewalApi`.
 * `src/api/mock` implements it in-memory; a real backend can replace it
 * without touching any screen.
 *
 * Money: fiat amounts are numbers in the currency's **main unit**, never in minor units —
 * 1 500 F CFA is `1500`. Each object carrying an amount carries its currency with it, and
 * not every currency has cents: see `lib/currency.ts`.
 * Dates: ISO 8601 strings.
 */

// The currencies Keewal Meere holds and converts between live in one registry, because the set
// is domain knowledge — minor units, the euro peg — not an API detail. See lib/currency.
export type { Currency } from '@/lib/currency'
import type { Currency } from '@/lib/currency'
/**
 * Four now, not three. « Actifs » used to hold African equities *and* crypto in one account,
 * which is how the app started, and the owner asked for crypto to stand on its own — the way
 * every bank that offers both keeps them apart, because one is a regulated security on a
 * local exchange and the other is not.
 *
 * `investing` is « Actifs » — shares on the BRVM, the NGX, the JSE and the NSE. `crypto` is
 * the coins. The old kind was called `crypto` and meant both; it means what it says now.
 */
export type AccountKind = 'checking' | 'savings' | 'investing' | 'crypto'
export type Locale = 'fr-SN' | 'en-NG'

// ---------- Session / user ----------

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  dateOfBirth?: string
  address?: Address
  verified: boolean
  twoFactorEnabled: boolean
  biometricsEnabled: boolean
  pinSet: boolean
  locale: Locale
  createdAt: string
}

export interface Address {
  line1: string
  line2?: string
  city: string
  province: string
  postalCode: string
  country: string
}

export interface Session {
  user: User
  token: string
  expiresAt: string
}

export type OnboardingStep = 'email' | 'code' | 'identity' | 'document' | 'twofactor' | 'product' | 'done'

export interface OnboardingState {
  step: OnboardingStep
  email?: string
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  address?: Address
  documentUploaded?: boolean
  twoFactorEnabled?: boolean
  firstProduct?: AccountKind
}

// ---------- Accounts ----------

/** A balance held in one currency. An account can hold several. */
export interface Pocket {
  currency: Currency
  amount: number
}

export interface Account {
  id: string
  kind: AccountKind
  name: string
  /** The account's home currency — what its `balance` is in, and what it is quoted in. */
  currency: Currency
  /** Value in `currency`. For an investment account: the market value of the holdings. */
  balance: number
  /**
   * Other currencies this account holds, beside the home one.
   *
   * Somebody paid in naira who saves in francs needs both to exist at once, which is what
   * the roadmap means by « multidevise, XOF/USD côte à côte ». Before this, every account
   * was XOF and a conversion had nowhere to land — so `/convertir` showed a rate, said
   * « converti », and moved nothing at all.
   */
  pockets?: Pocket[]
  /** Change over the last 24h (fiat) */
  change24h: number
  /** Change over the last 24h (%) */
  change24hPct: number
  /** Only for savings */
  apy?: number
  /** Only for crypto: recent value points for a sparkline */
  sparkline?: number[]
  openedAt: string
}

/**
 * What someone copies onto a transfer form. The fields are the UEMOA/CEMAC RIB — bank
 * code, branch code, account number, RIB key — not the Canadian institution-and-transit
 * pair these used to be. A Dakar bank does not have a transit number, and pasting one into
 * a wire form is how a transfer bounces.
 */
export interface AccountDetails {
  accountId: string
  holderName: string
  /** Code banque — five characters in the UEMOA RIB. */
  bankCode: string
  /** Code guichet — the branch, five characters. */
  branchCode: string
  accountNumber: string
  /** Clé RIB — the two check digits that make the rest verifiable. */
  ribKey: string
  iban: string
  swift: string
}

// ---------- Card ----------

export interface Card {
  id: string
  last4: string
  holderName: string
  expiryMonth: number
  expiryYear: number
  frozen: boolean
  /** Full PAN is only revealed on explicit request */
  kind: 'virtual' | 'physical'
}

export interface CardSecrets {
  pan: string
  cvv: string
}

// ---------- Transactions ----------

export type TransactionType =
  | 'card'
  | 'transfer_in'
  | 'transfer_out'
  | 'etransfer_in'
  | 'etransfer_out'
  | 'deposit'
  | 'withdrawal'
  | 'interest'
  /* Buying a share of Sonatel and buying a bitcoin are the same movement from the
     account's point of view, and the app lists both under « Actifs ». These used to be
     `crypto_buy` / `crypto_sell`, which named half the product. */
  | 'asset_buy'
  | 'asset_sell'
  | 'crypto_send'
  | 'crypto_receive'
  | 'recurring_buy'
  | 'refund'
  | 'fee'

export type TransactionStatus = 'pending' | 'posted' | 'failed' | 'reversed'

export type TransactionCategory =
  | 'groceries'
  | 'restaurants'
  | 'transport'
  | 'shopping'
  | 'subscriptions'
  | 'housing'
  | 'utilities'
  | 'health'
  | 'entertainment'
  | 'travel'
  | 'transfer'
  | 'income'
  | 'savings'
  | 'crypto'
  | 'fees'
  | 'other'

export interface Transaction {
  id: string
  accountId: string
  type: TransactionType
  status: TransactionStatus
  /** Signed amount in `currency`: negative = money out. */
  amount: number
  currency: Currency
  /** Merchant or counterparty display name */
  counterparty: string
  category: TransactionCategory
  /** ISO datetime of the transaction */
  date: string
  /** ISO datetime when it settled (if posted) */
  postedAt?: string
  cardLast4?: string
  note?: string
  /** Crypto details when applicable */
  asset?: { assetId: string; symbol: string; quantity: number; price: number }
  /** Location / channel */
  channel?: 'card_present' | 'online' | 'app' | 'bank'
  reference?: string
  receiptAvailable?: boolean
}

export interface TransactionFilter {
  accountId?: string
  types?: TransactionType[]
  categories?: TransactionCategory[]
  minAmount?: number
  maxAmount?: number
  from?: string
  to?: string
  query?: string
  status?: TransactionStatus[]
  limit?: number
}

// ---------- Crypto ----------

export type ChartRange = '1D' | '1W' | '1M' | '1Y' | 'MAX'

export interface CryptoAsset {
  id: string
  symbol: string
  name: string
  /** Price in the account's home currency. */
  price: number
  change24h: number
  change24hPct: number
  /** Last 24 points for a mini sparkline */
  sparkline: number[]
  marketCap: number
  volume24h: number
  circulatingSupply: number
  description: string
  networks: CryptoNetwork[]
  /** Explicit spread applied on buy/sell (e.g. 0.015 = 1,5 %) */
  spreadPct: number
  minTrade: number
  /** Decimal precision for quantities */
  decimals: number
  /** Whether the user follows this asset */
  watched: boolean
  rank: number
  /** What kind of thing this is. Equities are the app's centre of gravity; crypto sits
      beside them, not above them. */
  assetClass: AssetClass
  /** Where it trades — « BRVM », « NGX », « JSE » for an equity, the chain for a coin. */
  market: string
  /** Equities only: the sector, for grouping and for a plain-language explanation. */
  sector?: string
}

export type AssetClass = 'equity' | 'crypto'

export interface CryptoNetwork {
  id: string
  name: string
  /** Estimated network fee in the asset unit */
  feeEstimate: number
  /** Estimated confirmation time in minutes */
  etaMinutes: number
  /** Warning shown before sending */
  warning: string
  addressPrefix: string
}

export interface PricePoint {
  t: number
  p: number
}

export interface PriceHistory {
  assetId: string
  range: ChartRange
  points: PricePoint[]
  /** Change over the range */
  change: number
  changePct: number
}

export interface Holding {
  assetId: string
  symbol: string
  quantity: number
  /** Average cost per unit, in the account currency */
  avgCost: number
  /** Market value, in the account currency */
  value: number
  /** Unrealised P&L */
  pnl: number
  pnlPct: number
}

export type OrderSide = 'buy' | 'sell'
export type AmountMode = 'fiat' | 'crypto'

export interface QuoteRequest {
  assetId: string
  side: OrderSide
  mode: AmountMode
  /** Either fiat amount (CAD) or crypto quantity depending on mode */
  amount: number
}

export interface Quote {
  id: string
  assetId: string
  symbol: string
  side: OrderSide
  /** Reference market price */
  marketPrice: number
  /** Price after spread */
  executionPrice: number
  spreadPct: number
  spreadAmount: number
  /** Flat fee in CAD (0 when none) */
  fee: number
  /** Crypto quantity */
  quantity: number
  /** Fiat subtotal before fee (quantity × executionPrice) */
  subtotal: number
  /** Total fiat debited (buy) or credited (sell) */
  total: number
  /** Quote validity */
  expiresAt: string
}

export interface Order {
  id: string
  quote: Quote
  status: TransactionStatus
  transactionId: string
  createdAt: string
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface RecurringBuy {
  id: string
  assetId: string
  symbol: string
  amount: number
  frequency: RecurringFrequency
  nextRun: string
  active: boolean
  createdAt: string
}

export interface ReceiveAddress {
  assetId: string
  networkId: string
  address: string
  /** Text payload for QR */
  qrPayload: string
}

export interface CryptoSendRequest {
  assetId: string
  networkId: string
  address: string
  quantity: number
}

export interface CryptoSendPreview {
  quantity: number
  networkFee: number
  totalDebit: number
  fiatValue: number
  etaMinutes: number
}

// ---------- Savings ----------

export interface SavingsSummary {
  accountId: string
  balance: number
  apy: number
  interestThisMonth: number
  interestAllTime: number
  nextPayoutDate: string
}

export interface SavingsGoal {
  id: string
  name: string
  target: number
  current: number
  monthlyContribution: number
  createdAt: string
  /** ISO date estimate */
  estimatedDate: string
}

export interface GoalInput {
  name: string
  target: number
  monthlyContribution: number
  initialDeposit?: number
}

// ---------- Funding / transfers ----------

/**
 * Where money comes *into* an account from. « e-Transfer » used to be one of these: an
 * Interac brand, in an app whose accounts are in Dakar. In this zone the everyday rail is
 * Mobile Money — a phone number is the account — so that is what it is called.
 */
export type FundingKind = 'bank' | 'wire' | 'mobile_money' | 'card'

/** How a transfer operator identifies the person receiving the money. */
export type TransferHandle = 'phone' | 'email' | 'tag' | 'account'

/** The families a transfer operator falls into, which is how the picker groups them. */
export type TransferFamily = 'mobile_money' | 'remittance' | 'wallet' | 'bank'

export interface TransferProvider {
  id: string
  name: string
  /** Short mark, at most 3 characters. Explicit because initials collide — "MTN MoMo" and
      "Moov Money" both reduce to MM, and two operators that look the same in a picker is
      the one thing a picker must not do. */
  mark: string
  family: TransferFamily
  handle: TransferHandle
  /** Where it reaches, in plain words — "Sénégal, Côte d'Ivoire, Mali…" */
  reach: string
  /** The currency the recipient is paid in. */
  currency: Currency
  feePct: number
  /** A flat fee on top, in `currency`. */
  feeFixed?: number
  eta: string
  etaMinutes: number
  limitPerDay: number
  /** False when the operator is listed but not yet connected. */
  available: boolean
  /** Why it is unavailable, when it is. */
  note?: string
}

export interface FundingSource {
  id: string
  kind: FundingKind
  label: string
  /** e.g. "···· 4821" */
  mask: string
  /** Human delay: "Instantané", "1 à 3 jours ouvrables" */
  eta: string
  etaMinutes: number
  feePct: number
  limitPerDay: number
}

export interface AddFundsRequest {
  sourceId: string
  destinationAccountId: string
  amount: number
}

export interface TransferRequest {
  fromAccountId: string
  toAccountId?: string
  /**
   * The rail this is going out on — Wave, Orange Money, MoneyGram… It was not sent at all:
   * the picker set it in the URL and the request left without it, so the back-end could
   * not know which operator to route to, nor whose fee applied. Required when
   * `method` is `operator`.
   */
  providerId?: string
  /**
   * `handle` is whatever the chosen operator identifies people by — a phone number for
   * Mobile Money, a tag for Revolut, an email for Wise. It was called `email`, and the
   * back-end validated it as one, so a Wave transfer addressed to a phone number was
   * refused as « Courriel du destinataire invalide » even after the form asked for a
   * phone. A wire carries bank coordinates instead. Both carry a name.
   */
  recipient?: { name: string; handle?: string; iban?: string; bic?: string }
  amount: number
  note?: string
  /**
   * `operator` covers every rail on `/envoyer/operateurs` — Wave, Orange Money, MoneyGram,
   * Interac and the rest. It was called `etransfer`, which named one Canadian rail out of
   * fifteen and put that brand in the contract.
   */
  method: 'internal' | 'operator' | 'wire'
}

export interface FxConvertRequest {
  accountId: string
  from: Currency
  to: Currency
  /** In `from`. */
  amount: number
}

export interface MoneyMovementResult {
  /** What the operator charged, in the sending currency. Shown, never buried. */
  fee?: number
  transactionId: string
  status: TransactionStatus
  eta: string
  etaMinutes: number
}

// ---------- Notifications ----------

export type NotificationKind = 'transaction' | 'security' | 'market' | 'savings' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  date: string
  read: boolean
  link?: string
}

// ---------- Profile ----------

export interface Device {
  id: string
  name: string
  platform: string
  lastActive: string
  current: boolean
}

export interface Statement {
  id: string
  accountId: string
  period: string
  /** YYYY-MM */
  month: string
  /**
   * Where the PDF actually is. **Absent means there is no document** — the demonstration
   * has nothing to hand over — and the screen has to say so rather than offer a download
   * button that toasts « téléchargement lancé » and downloads nothing. A real back-end
   * returns a signed URL here and the button works.
   */
  url?: string
}

export interface TaxDocument {
  id: string
  name: string
  year: number
  available: boolean
  url?: string
}

// ---------- Risk profile ----------

/**
 * What kind of investor somebody is, by their own answer.
 *
 * It exists to change what the app *says* before a volatile order, not to lock anybody out.
 * The rule this product follows is « warn before, not after »: a consequence worth knowing
 * belongs beside the control while the decision is still open, and refusing an adult their
 * own money is a different thing that this app has no standing to do.
 */
export type RiskLevel = 'prudent' | 'equilibre' | 'dynamique'

export interface RiskProfile {
  level: RiskLevel
  /** Answer id per question id, kept so the questionnaire can be reopened as filled in. */
  answers: Record<string, string>
  completedAt: string
}

export interface NotificationPrefs {
  transactions: boolean
  security: boolean
  market: boolean
  savings: boolean
  marketing: boolean
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  biometricsEnabled: boolean
  pinSet: boolean
  /** Session timeout in minutes */
  sessionTimeoutMinutes: number
}

// ---------- Errors ----------

export class ApiError extends Error {
  constructor(
    message: string,
    public code: 'network' | 'offline' | 'validation' | 'insufficient_funds' | 'unauthorized' | 'not_found' | 'rate_limited' | 'frozen' | 'unknown' = 'unknown',
    public details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------- The contract ----------

export type Unsubscribe = () => void

export interface KeewalApi {
  auth: {
    getSession(): Promise<Session | null>
    requestCode(email: string): Promise<{ sent: true; devHint?: string }>
    /** If the e-mail belongs to an existing user, a session is opened and returned. */
    verifyCode(email: string, code: string): Promise<{ ok: true; session?: Session }>
    getOnboarding(): Promise<OnboardingState>
    saveOnboarding(patch: Partial<OnboardingState>): Promise<OnboardingState>
    uploadIdentityDocument(file: { name: string; size: number; type: string }): Promise<{ ok: true }>
    completeOnboarding(): Promise<Session>
    setPin(pin: string): Promise<{ ok: true }>
    verifyPin(pin: string): Promise<{ ok: boolean }>
    signOut(): Promise<void>
  }
  accounts: {
    list(): Promise<Account[]>
    get(id: string): Promise<Account>
    details(id: string): Promise<AccountDetails>
    /** Total net worth over time (all accounts combined). */
    history(range: ChartRange): Promise<PriceHistory>
  }
  transactions: {
    list(filter?: TransactionFilter): Promise<Transaction[]>
    get(id: string): Promise<Transaction>
    report(id: string, reason: string): Promise<{ caseId: string }>
    requestReceipt(id: string): Promise<{ sentTo: string }>
  }
  card: {
    get(): Promise<Card>
    setFrozen(frozen: boolean): Promise<Card>
    reveal(): Promise<CardSecrets>
  }
  crypto: {
    listAssets(): Promise<CryptoAsset[]>
    getAsset(id: string): Promise<CryptoAsset>
    setWatched(id: string, watched: boolean): Promise<CryptoAsset>
    history(id: string, range: ChartRange): Promise<PriceHistory>
    /** The book's own curve: each holding's series times the quantity held, summed. */
    portfolioHistory(range: ChartRange): Promise<PriceHistory>
    holdings(): Promise<Holding[]>
    quote(req: QuoteRequest): Promise<Quote>
    placeOrder(quoteId: string): Promise<Order>
    recurring: {
      list(): Promise<RecurringBuy[]>
      create(input: { assetId: string; amount: number; frequency: RecurringFrequency }): Promise<RecurringBuy>
      update(id: string, patch: Partial<Pick<RecurringBuy, 'amount' | 'frequency' | 'active'>>): Promise<RecurringBuy>
      remove(id: string): Promise<void>
    }
    receiveAddress(assetId: string, networkId: string): Promise<ReceiveAddress>
    previewSend(req: CryptoSendRequest): Promise<CryptoSendPreview>
    send(req: CryptoSendRequest): Promise<MoneyMovementResult>
    /** Subscribe to price ticks (polling or socket). Returns unsubscribe. */
    subscribePrices(listener: (assets: CryptoAsset[]) => void): Unsubscribe
  }
  savings: {
    summary(): Promise<SavingsSummary>
    history(range: ChartRange): Promise<PriceHistory>
    deposit(amount: number, fromAccountId: string): Promise<MoneyMovementResult>
    withdraw(amount: number, toAccountId: string): Promise<MoneyMovementResult>
    goals: {
      list(): Promise<SavingsGoal[]>
      create(input: GoalInput): Promise<SavingsGoal>
      update(id: string, patch: Partial<GoalInput>): Promise<SavingsGoal>
      contribute(id: string, amount: number): Promise<SavingsGoal>
      remove(id: string): Promise<void>
    }
  }
  fx: {
    /** Move money between two currencies inside the same account. */
    convert(req: FxConvertRequest): Promise<MoneyMovementResult>
  }
  funding: {
    sources(): Promise<FundingSource[]>
    addFunds(req: AddFundsRequest): Promise<MoneyMovementResult>
  }
  transfers: {
    send(req: TransferRequest): Promise<MoneyMovementResult>
    /** Every operator money can be sent through, connected or not. */
    providers(): Promise<TransferProvider[]>
  }
  notifications: {
    list(): Promise<AppNotification[]>
    markRead(id: string): Promise<void>
    markAllRead(): Promise<void>
    prefs(): Promise<NotificationPrefs>
    setPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>
  }
  profile: {
    me(): Promise<User>
    update(patch: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'address' | 'locale'>>): Promise<User>
    security(): Promise<SecuritySettings>
    setSecurity(patch: Partial<SecuritySettings>): Promise<SecuritySettings>
    devices(): Promise<Device[]>
    revokeDevice(id: string): Promise<void>
    statements(): Promise<Statement[]>
    taxDocuments(): Promise<TaxDocument[]>
    /** `null` until the questionnaire has been answered. */
    risk(): Promise<RiskProfile | null>
    setRisk(answers: Record<string, string>): Promise<RiskProfile>
  }
  /** Fires whenever server-side state changes (e.g. a pending transaction settles). */
  subscribe(listener: (event: ApiEvent) => void): Unsubscribe
}

export type ApiEvent =
  | { type: 'transaction'; transaction: Transaction }
  | { type: 'accounts' }
  | { type: 'card'; card: Card }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'goals' }
  | { type: 'recurring' }
