/**
 * Deterministic seed data. Dates are relative to "now" so day groupings
 * (Aujourd'hui / Hier) stay meaningful, but the PRNG is fixed so the set is
 * identical on every reload.
 */
import { createPrng } from '@/lib/prng'
import type {
  Account,
  AccountDetails,
  AppNotification,
  Card,
  CryptoAsset,
  Device,
  FundingSource,
  TransferProvider,
  Holding,
  RecurringBuy,
  SavingsGoal,
  Statement,
  TaxDocument,
  Transaction,
  TransactionCategory,
  User,
} from '../types'

export const NOW = new Date()
const DAY = 86_400_000

function daysAgo(n: number, hour = 12, minute = 0): string {
  const d = new Date(NOW.getTime() - n * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
function daysAhead(n: number): string {
  const d = new Date(NOW.getTime() + n * DAY)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export const IDS = {
  checking: 'acc_chq_01',
  savings: 'acc_epg_01',
  crypto: 'acc_cry_01',
} as const

export const seedUser: User = {
  id: 'usr_01',
  firstName: 'Aïssatou',
  lastName: 'Ndiaye',
  email: 'aissatou.ndiaye@exemple.sn',
  phone: '+221 77 555 01 48',
  dateOfBirth: '1994-03-22',
  address: { line1: '12, rue Carnot', line2: 'Plateau', city: 'Dakar', province: 'Dakar', postalCode: '11000', country: 'SN' },
  verified: true,
  twoFactorEnabled: true,
  biometricsEnabled: false,
  pinSet: true,
  locale: 'fr-SN',
  createdAt: daysAgo(112),
}

export const seedCard: Card = {
  id: 'card_01',
  last4: '7364',
  holderName: 'AÏSSATOU NDIAYE',
  expiryMonth: 8,
  expiryYear: 2029,
  frozen: false,
  kind: 'virtual',
}

/* A UEMOA RIB, and an IBAN that passes this app's own ISO 13616 check — a demonstration
   number that its own validator rejects is worse than no number. It was Canadian, and
   `CA62…` is doubly wrong: Canada does not issue IBANs at all. */
export const seedAccountDetails: AccountDetails = {
  accountId: IDS.checking,
  holderName: 'Aïssatou Ndiaye',
  bankCode: 'SN010',
  branchCode: '01050',
  accountNumber: '000012345678',
  ribKey: '76',
  iban: 'SN39 0100 1050 0000 0123 4567 8976',
  swift: 'KWMLSNDA',
}

// ---------- Crypto ----------

interface AssetSeed {
  id: string
  symbol: string
  name: string
  price: number
  change24hPct: number
  marketCap: number
  volume24h: number
  circulatingSupply: number
  description: string
  networks: CryptoAsset['networks']
  decimals: number
  minTrade: number
  spreadPct: number
  watched: boolean
  rank: number
  assetClass?: CryptoAsset['assetClass']
  market?: string
  sector?: string
}

const eth = (prefix = '0x') => ({ addressPrefix: prefix })

/** An equity does not settle on a chain, so it carries no network. */
const NO_NETWORK: CryptoAsset['networks'] = []

/** The CFA franc's treaty peg to the euro. Fixed, not quoted — see lib/currency. */
const XOF_PER_EUR = 655.957

const assetSeeds: AssetSeed[] = [
  /* ---- Actions africaines ----
     BRVM (Abidjan, zone UEMOA), NGX (Lagos), JSE (Johannesburg). Prices are authored on a
     ~1:1 "one unit ≈ one euro" scale and carried across the peg once, in the map below —
     so Sonatel reads around 29 000 F CFA, which is where it actually trades on the BRVM. */
  {
    id: 'dangcem', symbol: 'DANGCEM', name: 'Dangote Cement', price: 0.62, change24hPct: 2.14, marketCap: 10_600_000_000, volume24h: 4_200_000, circulatingSupply: 17_040_000_000, decimals: 0, minTrade: 1, spreadPct: 0.008, watched: true, rank: 1,
    assetClass: 'equity', market: 'NGX', sector: 'Matériaux',
    description: 'Premier cimentier d’Afrique subsaharienne, présent dans dix pays. Son chiffre d’affaires suit la construction de routes, de logements et d’infrastructures publiques.',
    networks: NO_NETWORK,
  },
  {
    id: 'sonatel', symbol: 'SNTS', name: 'Sonatel', price: 44.5, change24hPct: 0.83, marketCap: 6_100_000_000, volume24h: 1_900_000, circulatingSupply: 100_000_000, decimals: 0, minTrade: 1, spreadPct: 0.009, watched: true, rank: 2,
    assetClass: 'equity', market: 'BRVM', sector: 'Télécommunications',
    description: 'Opérateur télécom du Sénégal, du Mali, de la Guinée et de la Sierra Leone. Première capitalisation de la BRVM, et l’un des rares titres à verser un dividende régulier.',
    networks: NO_NETWORK,
  },
  {
    id: 'mtnn', symbol: 'MTNN', name: 'MTN Nigeria', price: 0.28, change24hPct: -1.36, marketCap: 5_700_000_000, volume24h: 3_400_000, circulatingSupply: 20_350_000_000, decimals: 0, minTrade: 1, spreadPct: 0.009, watched: false, rank: 3,
    assetClass: 'equity', market: 'NGX', sector: 'Télécommunications',
    description: 'Premier opérateur mobile du Nigéria, avec plus de 75 millions d’abonnés. Son activité de paiement mobile croît plus vite que la voix.',
    networks: NO_NETWORK,
  },
  {
    id: 'nsiabrvm', symbol: 'NSBC', name: 'NSIA Banque CI', price: 12.8, change24hPct: 1.05, marketCap: 820_000_000, volume24h: 340_000, circulatingSupply: 64_000_000, decimals: 0, minTrade: 1, spreadPct: 0.011, watched: false, rank: 6,
    assetClass: 'equity', market: 'BRVM', sector: 'Banque',
    description: 'Banque commerciale ivoirienne, active dans le crédit aux entreprises et la banque de détail en zone UEMOA.',
    networks: NO_NETWORK,
  },
  {
    id: 'naspers', symbol: 'NPN', name: 'Naspers', price: 285.0, change24hPct: -0.42, marketCap: 21_000_000_000, volume24h: 8_100_000, circulatingSupply: 73_700_000, decimals: 0, minTrade: 1, spreadPct: 0.008, watched: false, rank: 4,
    assetClass: 'equity', market: 'JSE', sector: 'Technologie',
    description: 'Groupe sud-africain d’investissement technologique. Sa participation historique dans Tencent reste le principal moteur de sa valorisation.',
    networks: NO_NETWORK,
  },
  {
    id: 'safaricom', symbol: 'SCOM', name: 'Safaricom', price: 0.19, change24hPct: 3.27, marketCap: 6_300_000_000, volume24h: 2_700_000, circulatingSupply: 40_070_000_000, decimals: 0, minTrade: 1, spreadPct: 0.009, watched: true, rank: 5,
    assetClass: 'equity', market: 'NSE', sector: 'Télécommunications',
    description: 'Opérateur kényan, éditeur de M-Pesa — le service d’argent mobile le plus utilisé du continent, et l’essentiel de sa croissance.',
    networks: NO_NETWORK,
  },
  {
    id: 'sonabel', symbol: 'CIEC', name: 'CIE Côte d’Ivoire', price: 6.4, change24hPct: -0.61, marketCap: 410_000_000, volume24h: 180_000, circulatingSupply: 64_000_000, decimals: 0, minTrade: 1, spreadPct: 0.012, watched: false, rank: 9,
    assetClass: 'equity', market: 'BRVM', sector: 'Énergie',
    description: 'Concessionnaire de la distribution d’électricité en Côte d’Ivoire. Revenus régulés, sensibles aux tarifs publics et à la demande industrielle.',
    networks: NO_NETWORK,
  },
  /* ---- Cryptomonnaies ---- */
  {
    id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 142_850, change24hPct: 1.42, marketCap: 2_830_000_000_000, volume24h: 48_000_000_000, circulatingSupply: 19_820_000, decimals: 8, minTrade: 1, spreadPct: 0.015, watched: true, rank: 1,
    description: 'Première monnaie numérique décentralisée. Son offre est plafonnée à 21 millions d’unités et son registre est sécurisé par la preuve de travail.',
    networks: [{ id: 'bitcoin', name: 'Bitcoin', feeEstimate: 0.00004, etaMinutes: 30, warning: 'Envoyez uniquement du BTC vers une adresse Bitcoin. Les fonds envoyés sur un autre réseau seront perdus.', ...eth('bc1q') }],
  },
  {
    id: 'eth', symbol: 'ETH', name: 'Ether', price: 6_420, change24hPct: -0.86, marketCap: 772_000_000_000, volume24h: 22_000_000_000, circulatingSupply: 120_300_000, decimals: 8, minTrade: 1, spreadPct: 0.015, watched: true, rank: 2,
    description: 'Actif natif du réseau Ethereum, utilisé pour payer les frais de calcul des contrats intelligents et des applications décentralisées.',
    networks: [
      { id: 'ethereum', name: 'Ethereum', feeEstimate: 0.00042, etaMinutes: 5, warning: 'Vérifiez que l’adresse de destination accepte l’ETH sur le réseau Ethereum.', ...eth() },
      { id: 'arbitrum', name: 'Arbitrum One', feeEstimate: 0.00003, etaMinutes: 2, warning: 'Adresse Arbitrum uniquement. Un envoi vers une adresse Ethereum L1 peut être irrécupérable.', ...eth() },
      { id: 'base', name: 'Base', feeEstimate: 0.00002, etaMinutes: 2, warning: 'Adresse Base uniquement. Les échanges centralisés n’acceptent pas tous ce réseau.', ...eth() },
    ],
  },
  {
    id: 'sol', symbol: 'SOL', name: 'Solana', price: 285.4, change24hPct: 3.18, marketCap: 156_000_000_000, volume24h: 6_100_000_000, circulatingSupply: 546_000_000, decimals: 6, minTrade: 1, spreadPct: 0.015, watched: true, rank: 5,
    description: 'Réseau à haut débit conçu pour les applications à faible latence. Les frais de transaction se comptent en fractions de cent.',
    networks: [{ id: 'solana', name: 'Solana', feeEstimate: 0.00005, etaMinutes: 1, warning: 'Adresse Solana uniquement (base58).', addressPrefix: '' }],
  },
  {
    id: 'xrp', symbol: 'XRP', name: 'XRP', price: 3.12, change24hPct: 0.54, marketCap: 178_000_000_000, volume24h: 4_200_000_000, circulatingSupply: 57_000_000_000, decimals: 6, minTrade: 1, spreadPct: 0.02, watched: false, rank: 4,
    description: 'Actif du XRP Ledger, orienté vers les paiements transfrontaliers rapides à faible coût.',
    networks: [{ id: 'xrpl', name: 'XRP Ledger', feeEstimate: 0.00001, etaMinutes: 1, warning: 'Un tag de destination peut être requis par le destinataire. Sans lui, les fonds peuvent être perdus.', addressPrefix: 'r' }],
  },
  {
    id: 'ada', symbol: 'ADA', name: 'Cardano', price: 1.08, change24hPct: -1.92, marketCap: 38_000_000_000, volume24h: 900_000_000, circulatingSupply: 35_200_000_000, decimals: 6, minTrade: 1, spreadPct: 0.02, watched: false, rank: 9,
    description: 'Réseau à preuve d’enjeu développé selon une approche de recherche évaluée par des pairs.',
    networks: [{ id: 'cardano', name: 'Cardano', feeEstimate: 0.17, etaMinutes: 2, warning: 'Adresse Cardano (Shelley) uniquement.', addressPrefix: 'addr1' }],
  },
  {
    id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.31, change24hPct: 4.75, marketCap: 45_000_000_000, volume24h: 2_300_000_000, circulatingSupply: 147_000_000_000, decimals: 4, minTrade: 1, spreadPct: 0.02, watched: false, rank: 8,
    description: 'Monnaie numérique née d’un mème, devenue un actif à forte communauté. Offre non plafonnée.',
    networks: [{ id: 'dogecoin', name: 'Dogecoin', feeEstimate: 1, etaMinutes: 10, warning: 'Adresse Dogecoin uniquement.', addressPrefix: 'D' }],
  },
  {
    id: 'link', symbol: 'LINK', name: 'Chainlink', price: 32.4, change24hPct: 2.11, marketCap: 21_000_000_000, volume24h: 700_000_000, circulatingSupply: 657_000_000, decimals: 6, minTrade: 1, spreadPct: 0.02, watched: true, rank: 12,
    description: 'Réseau d’oracles qui relie les contrats intelligents à des données du monde réel.',
    networks: [
      { id: 'ethereum', name: 'Ethereum', feeEstimate: 0.12, etaMinutes: 5, warning: 'Jeton ERC-20 : l’adresse doit accepter le LINK sur Ethereum.', ...eth() },
      { id: 'arbitrum', name: 'Arbitrum One', feeEstimate: 0.01, etaMinutes: 2, warning: 'Adresse Arbitrum uniquement.', ...eth() },
    ],
  },
  {
    id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 58.7, change24hPct: -2.36, marketCap: 24_000_000_000, volume24h: 620_000_000, circulatingSupply: 410_000_000, decimals: 6, minTrade: 1, spreadPct: 0.02, watched: false, rank: 14,
    description: 'Plateforme de sous-réseaux personnalisables avec finalité de transaction rapide.',
    networks: [{ id: 'avalanche-c', name: 'Avalanche C-Chain', feeEstimate: 0.002, etaMinutes: 1, warning: 'Réseau C-Chain uniquement. Les adresses X-Chain ne sont pas prises en charge.', ...eth() }],
  },
]

/** Sparkline: 24 hourly points ending at the current price, deterministic per asset. */
export function makeSparkline(seed: number, price: number, changePct: number, n = 24): number[] {
  const rng = createPrng(seed)
  const start = price / (1 + changePct / 100)
  const pts: number[] = []
  let v = start
  for (let i = 0; i < n; i++) {
    const drift = (price - v) / (n - i)
    v = v + drift + v * rng.range(-0.006, 0.006)
    pts.push(v)
  }
  pts[n - 1] = price
  return pts
}

export const seedAssets: CryptoAsset[] = assetSeeds.map((a, i) => {
  // One crossing of the peg, here — the same boundary the balances and transactions use.
  const price = a.price * XOF_PER_EUR
  const change24h = price - price / (1 + a.change24hPct / 100)
  return {
    ...a,
    price,
    marketCap: a.marketCap * XOF_PER_EUR,
    volume24h: a.volume24h * XOF_PER_EUR,
    assetClass: a.assetClass ?? 'crypto',
    market: a.market ?? a.networks[0]?.name ?? 'Crypto',
    change24h,
    sparkline: makeSparkline(1000 + i, price, a.change24hPct),
  }
})

/* An average cost is a price, so it crosses the peg with the prices — it was authored on
   the same ~1:1 scale. Leaving it behind while `price` moved made every holding show a
   five-figure percentage gain: the cost basis was 656 times too small. */
export const seedHoldingsRaw: Array<Pick<Holding, 'assetId' | 'quantity' | 'avgCost'>> = [
  { assetId: 'btc', quantity: 0.0428, avgCost: 131_200 * XOF_PER_EUR },
  { assetId: 'eth', quantity: 0.85, avgCost: 5_980 * XOF_PER_EUR },
  { assetId: 'sol', quantity: 12.5, avgCost: 310.5 * XOF_PER_EUR },
  { assetId: 'link', quantity: 40, avgCost: 28.9 * XOF_PER_EUR },
]

export const seedRecurring: RecurringBuy[] = [
  { id: 'rec_01', assetId: 'btc', symbol: 'BTC', amount: Math.round(50 * XOF_PER_EUR), frequency: 'weekly', nextRun: daysAhead(3), active: true, createdAt: daysAgo(70) },
  { id: 'rec_02', assetId: 'eth', symbol: 'ETH', amount: Math.round(100 * XOF_PER_EUR), frequency: 'monthly', nextRun: daysAhead(12), active: true, createdAt: daysAgo(45) },
]

// ---------- Accounts ----------

/* Round francs, the way a balance is actually quoted. */
export const seedBalances = {
  checking: 2_766_500,
  savings: 8_290_000,
}

export const SAVINGS_APY = 4.0

export function makeAccounts(cryptoValue: number, cryptoChange: number, cryptoChangePct: number, cryptoSparkline: number[], balances = seedBalances): Account[] {
  return [
    { id: IDS.checking, kind: 'checking', name: 'Chèque', currency: 'XOF', balance: balances.checking, change24h: -56_675, change24hPct: -2.0, openedAt: daysAgo(112) },
    { id: IDS.savings, kind: 'savings', name: 'Épargne', currency: 'XOF', balance: balances.savings, change24h: 912, change24hPct: 0.011, apy: SAVINGS_APY, openedAt: daysAgo(110) },
    { id: IDS.crypto, kind: 'crypto', name: 'Crypto', currency: 'XOF', balance: cryptoValue, change24h: cryptoChange, change24hPct: cryptoChangePct, sparkline: cryptoSparkline, openedAt: daysAgo(98) },
  ]
}

// ---------- Transactions (~60 over 3 months) ----------

interface MerchantSeed {
  name: string
  category: TransactionCategory
  min: number
  max: number
  channel: Transaction['channel']
}

/**
 * A week of spending in Dakar, **priced in francs**.
 *
 * Both halves of that sentence were wrong before. The names were Montréal's — Épicerie
 * Beaubien, Quincaillerie Villeray, Cinéma Beaubien — which is the first thing anyone
 * scrolling the transaction list would have noticed about an app that opens with « Investir
 * depuis l'Afrique de l'Ouest ». And the amounts were authored on a one-unit-≈-one-euro
 * scale and multiplied by the peg, so a hardware shop charged 74 222 F CFA: arithmetically
 * fine, and a price no shop has ever put on anything. Francs are quoted in round numbers,
 * so these are authored in francs and rounded to the nearest 25.
 *
 * The places are named by neighbourhood and trade rather than after real businesses: a
 * demonstration should not put invented charges against somebody's actual shop.
 */
const merchants: MerchantSeed[] = [
  { name: 'Marché Kermel', category: 'groceries', min: 3_000, max: 18_000, channel: 'card_present' },
  { name: 'Supérette Point E', category: 'groceries', min: 1_500, max: 9_000, channel: 'card_present' },
  { name: 'Café Touba — Médina', category: 'restaurants', min: 500, max: 1_500, channel: 'card_present' },
  { name: 'Restaurant La Teranga', category: 'restaurants', min: 8_000, max: 35_000, channel: 'card_present' },
  { name: 'Boulangerie du Plateau', category: 'restaurants', min: 500, max: 3_000, channel: 'card_present' },
  { name: 'Transport urbain', category: 'transport', min: 250, max: 250, channel: 'card_present' },
  { name: 'Station-service Ouakam', category: 'transport', min: 15_000, max: 40_000, channel: 'card_present' },
  { name: 'Pharmacie Mermoz', category: 'health', min: 2_500, max: 25_000, channel: 'card_present' },
  { name: 'Librairie du Plateau', category: 'shopping', min: 4_000, max: 30_000, channel: 'card_present' },
  { name: 'Tissus — marché HLM', category: 'shopping', min: 10_000, max: 60_000, channel: 'card_present' },
  { name: 'Abonnement musique', category: 'subscriptions', min: 3_500, max: 3_500, channel: 'online' },
  { name: 'Abonnement vidéo', category: 'subscriptions', min: 5_500, max: 5_500, channel: 'online' },
  { name: 'Forfait mobile', category: 'utilities', min: 15_000, max: 15_000, channel: 'online' },
  { name: 'Cinéma — Sea Plaza', category: 'entertainment', min: 3_000, max: 6_000, channel: 'card_present' },
  { name: 'Quincaillerie Grand-Yoff', category: 'shopping', min: 2_000, max: 75_000, channel: 'card_present' },
]

export function makeTransactions(): Transaction[] {
  const rng = createPrng(20260910)
  const txs: Transaction[] = []
  let n = 0
  const id = () => `tx_${String(++n).padStart(4, '0')}`

  /* Amounts below are **francs**, written as someone in Dakar would say them. They used
     to be euros multiplied by the peg here, which was arithmetically correct and produced
     a salary of 1 432 938 F CFA and a rent of 934 739 — numbers nobody has ever been paid
     or charged. XOF has no centimes either, so everything is whole.

     Asset prices are the exception and still cross the peg where they are used: a share of
     Dangote or a bitcoin has an international price, and that one *is* a conversion. */
  const add = (t: Omit<Transaction, 'id' | 'currency'>) => txs.push({ id: id(), currency: 'XOF', ...t, amount: Math.round(t.amount) })

  // Card spend: ~40 over 90 days
  for (let i = 0; i < 40; i++) {
    const m = rng.pick(merchants)
    const day = rng.int(0, 89)
    // To the nearest 25 F: francs are quoted in round numbers, and the coins go 25, 50, 100.
    const amount = -Math.round(rng.range(m.min, m.max) / 25) * 25
    add({
      accountId: IDS.checking,
      type: 'card',
      status: day === 0 && i % 3 === 0 ? 'pending' : 'posted',
      amount,
      counterparty: m.name,
      category: m.category,
      date: daysAgo(day, rng.int(7, 21), rng.int(0, 59)),
      postedAt: day === 0 ? undefined : daysAgo(day - 1, 3),
      cardLast4: seedCard.last4,
      channel: m.channel,
      reference: `KL${rng.int(100000, 999999)}`,
      receiptAvailable: rng.chance(0.6),
    })
  }

  // Salary: 3 months, twice a month
  for (const day of [2, 16, 32, 46, 62, 76]) {
    add({ accountId: IDS.checking, type: 'transfer_in', status: 'posted', amount: 425_000, counterparty: 'Salaire — Teranga Digital', category: 'income', date: daysAgo(day, 6, 5), postedAt: daysAgo(day, 6, 5), channel: 'bank', reference: `PAIE${1000 + day}` })
  }

  // Rent: monthly
  for (const day of [9, 40, 70]) {
    add({ accountId: IDS.checking, type: 'transfer_out', status: 'posted', amount: -250_000, counterparty: 'Loyer — Résidence Point E', category: 'housing', date: daysAgo(day, 8), postedAt: daysAgo(day, 8), channel: 'bank' })
  }

  // Utilities
  for (const day of [5, 36, 66]) {
    add({ accountId: IDS.checking, type: 'transfer_out', status: 'posted', amount: -35_000, counterparty: 'Senelec — électricité', category: 'utilities', date: daysAgo(day, 10), postedAt: daysAgo(day, 10), channel: 'online' })
  }

  // e-transfers
  add({ accountId: IDS.checking, type: 'etransfer_in', status: 'posted', amount: 45_000, counterparty: 'Amina D.', category: 'transfer', date: daysAgo(1, 19, 42), postedAt: daysAgo(1, 19, 43), channel: 'app', note: 'Ta part du souper' })
  add({ accountId: IDS.checking, type: 'etransfer_out', status: 'posted', amount: -15_000, counterparty: 'Karim B.', category: 'transfer', date: daysAgo(4, 13, 10), postedAt: daysAgo(4, 13, 12), channel: 'app', note: 'Billets' })
  add({ accountId: IDS.checking, type: 'etransfer_out', status: 'posted', amount: -100_000, counterparty: 'Fatou N.', category: 'transfer', date: daysAgo(27, 9, 5), postedAt: daysAgo(27, 9, 6), channel: 'app' })
  add({ accountId: IDS.checking, type: 'refund', status: 'posted', amount: 12_000, counterparty: 'Librairie du Plateau', category: 'shopping', date: daysAgo(12, 15), postedAt: daysAgo(11, 3), cardLast4: seedCard.last4, channel: 'online' })

  // Savings: deposits + monthly interest
  for (const day of [3, 33, 63]) {
    add({ accountId: IDS.savings, type: 'deposit', status: 'posted', amount: 200_000, counterparty: 'Depuis Chèque', category: 'savings', date: daysAgo(day, 6, 30), postedAt: daysAgo(day, 6, 30), channel: 'app' })
    add({ accountId: IDS.checking, type: 'transfer_out', status: 'posted', amount: -200_000, counterparty: 'Vers Épargne', category: 'savings', date: daysAgo(day, 6, 30), postedAt: daysAgo(day, 6, 30), channel: 'app' })
  }
  for (const [day, amt] of [[10, 27_465], [41, 26_050], [71, 24_365]] as const) {
    add({ accountId: IDS.savings, type: 'interest', status: 'posted', amount: amt, counterparty: 'Intérêts — Épargne', category: 'income', date: daysAgo(day, 0, 5), postedAt: daysAgo(day, 0, 5), channel: 'app' })
  }
  add({ accountId: IDS.savings, type: 'withdrawal', status: 'posted', amount: -125_000, counterparty: 'Vers Chèque', category: 'savings', date: daysAgo(19, 11), postedAt: daysAgo(19, 11), channel: 'app' })
  add({ accountId: IDS.checking, type: 'transfer_in', status: 'posted', amount: 125_000, counterparty: 'Depuis Épargne', category: 'savings', date: daysAgo(19, 11), postedAt: daysAgo(19, 11), channel: 'app' })

  // Crypto: buys/sells + recurring
  const cryptoTrades: Array<[number, 'crypto_buy' | 'crypto_sell' | 'recurring_buy', string, string, number, number]> = [
    [85, 'crypto_buy', 'btc', 'BTC', 0.02, 128_400],
    [78, 'crypto_buy', 'eth', 'ETH', 0.5, 5_820],
    [60, 'crypto_buy', 'sol', 'SOL', 12.5, 310.5],
    [52, 'crypto_buy', 'btc', 'BTC', 0.015, 133_100],
    [44, 'crypto_buy', 'link', 'LINK', 40, 28.9],
    [38, 'crypto_sell', 'eth', 'ETH', 0.15, 6_150],
    [30, 'crypto_buy', 'eth', 'ETH', 0.5, 6_210],
    [21, 'recurring_buy', 'btc', 'BTC', 0.00038, 131_500],
    [14, 'recurring_buy', 'btc', 'BTC', 0.00036, 138_900],
    [7, 'recurring_buy', 'btc', 'BTC', 0.00035, 141_200],
    [7, 'crypto_buy', 'btc', 'BTC', 0.0035, 141_200],
  ]
  for (const [day, type, assetId, symbol, qty, price] of cryptoTrades) {
    // The price above is on the asset scale (one unit ≈ one euro), like every other price
    // in this file; the francs that leave the account are that, crossed once.
    const fiat = Math.round(qty * price * XOF_PER_EUR)
    const sell = type === 'crypto_sell'
    add({ accountId: IDS.crypto, type, status: 'posted', amount: sell ? fiat : -fiat, counterparty: `${sell ? 'Vente' : 'Achat'} ${symbol}`, category: 'crypto', date: daysAgo(day, 9, 30), postedAt: daysAgo(day, 9, 31), channel: 'app', asset: { assetId, symbol, quantity: qty, price } })
    add({ accountId: IDS.checking, type: sell ? 'transfer_in' : 'transfer_out', status: 'posted', amount: sell ? fiat : -fiat, counterparty: sell ? 'Depuis Crypto' : 'Vers Crypto', category: 'crypto', date: daysAgo(day, 9, 30), postedAt: daysAgo(day, 9, 31), channel: 'app' })
  }

  txs.sort((a, b) => (a.date < b.date ? 1 : -1))
  return txs
}

// ---------- Savings goals ----------

/* In francs, like everything else the account holds. These were euro figures used raw, so
   « Voyage à Dakar » was a 3 500 F CFA goal — about five euros — shown to someone who
   lives in Dakar. Both the amounts and the ambition were wrong. */
export const seedGoals: SavingsGoal[] = [
  { id: 'goal_01', name: 'Tabaski', target: 750_000, current: 410_000, monthlyContribution: 60_000, createdAt: daysAgo(64), estimatedDate: daysAhead(200) },
  { id: 'goal_02', name: 'Fonds d’urgence', target: 3_000_000, current: 1_850_000, monthlyContribution: 150_000, createdAt: daysAgo(105), estimatedDate: daysAhead(290) },
]

// ---------- Notifications ----------

export const seedNotifications: AppNotification[] = [
  { id: 'ntf_01', kind: 'transaction', title: 'Paiement de 23,40 $', body: 'Café Saint-Viateur · Carte ···· 7364', date: daysAgo(0, 8, 42), read: false, link: '/carte' },
  { id: 'ntf_02', kind: 'market', title: 'SOL en hausse de 3,2 % aujourd’hui', body: 'Votre position vaut maintenant 3 567,50 $.', date: daysAgo(0, 7, 15), read: false, link: '/crypto/sol' },
  { id: 'ntf_03', kind: 'transaction', title: 'e-Transfer reçu · 120,00 $', body: 'Amina D. vous a envoyé de l’argent.', date: daysAgo(1, 19, 43), read: false, link: '/carte' },
  { id: 'ntf_04', kind: 'security', title: 'Nouvelle connexion', body: 'iPhone · Dakar, Sénégal. Ce n’était pas vous ? Sécurisez votre compte.', date: daysAgo(2, 21, 3), read: true, link: '/profil/securite' },
  { id: 'ntf_05', kind: 'savings', title: 'Objectif « Voyage à Dakar » à 53 %', body: 'Encore 1 650 $ à épargner. Prochain versement le 1er du mois.', date: daysAgo(3, 9, 0), read: true, link: '/epargne' },
  { id: 'ntf_06', kind: 'transaction', title: 'Achat récurrent exécuté', body: '50,00 $ de BTC achetés au prix de 141 200 $.', date: daysAgo(7, 9, 31), read: true, link: '/crypto/recurrents' },
  { id: 'ntf_07', kind: 'savings', title: 'Intérêts versés · 41,88 $', body: 'Votre compte Épargne a rapporté 41,88 $ ce mois-ci.', date: daysAgo(10, 0, 5), read: true, link: '/epargne' },
  { id: 'ntf_08', kind: 'system', title: 'Relevé de mois disponible', body: 'Votre relevé Chèque est prêt à être téléchargé.', date: daysAgo(10, 6, 0), read: true, link: '/profil/documents' },
]

// ---------- Funding ----------

export const seedFundingSources: FundingSource[] = [
  { id: 'src_bank', kind: 'bank', label: 'Banque liée', mask: 'Compte ···· 4821', eta: '1 à 3 jours ouvrables', etaMinutes: 2_880, feePct: 0, limitPerDay: 15_000_000 },
  { id: 'src_momo', kind: 'mobile_money', label: 'Mobile Money', mask: 'Wave · +221 77 555 01 48', eta: 'Instantané', etaMinutes: 2, feePct: 0.01, limitPerDay: 2_000_000 },
  { id: 'src_wire', kind: 'wire', label: 'Virement bancaire', mask: 'Instructions fournies', eta: '1 à 2 jours ouvrables', etaMinutes: 1_440, feePct: 0, limitPerDay: 65_000_000 },
  { id: 'src_card', kind: 'card', label: 'Carte bancaire', mask: '···· 2210', eta: 'Instantané', etaMinutes: 0, feePct: 0.0, limitPerDay: 650_000 },
]

// ---------- Profile ----------

export const seedDevices: Device[] = [
  { id: 'dev_01', name: 'Cet appareil', platform: 'Navigateur web', lastActive: NOW.toISOString(), current: true },
  { id: 'dev_02', name: 'iPhone d’Aïssatou', platform: 'iOS 19', lastActive: daysAgo(0, 8, 30), current: false },
  { id: 'dev_03', name: 'MacBook', platform: 'macOS', lastActive: daysAgo(6, 20), current: false },
]

function monthKey(offset: number): { key: string; label: string } {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - offset, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const label = new Intl.DateTimeFormat('fr-SN', { month: 'long', year: 'numeric' }).format(d)
  return { key, label: label.charAt(0).toUpperCase() + label.slice(1) }
}

export const seedStatements: Statement[] = [1, 2, 3].flatMap((offset) => {
  const { key, label } = monthKey(offset)
  return [
    { id: `stm_chq_${key}`, accountId: IDS.checking, period: label, month: key, url: '#' },
    { id: `stm_epg_${key}`, accountId: IDS.savings, period: label, month: key, url: '#' },
  ]
})

/* The documents a UEMOA investor actually receives. The IRVM is the withholding on income
   from securities in the zone — the BRVM equivalent of the T5 that used to be listed here,
   alongside a Relevé 3 from Québec. */
export const seedTaxDocuments: TaxDocument[] = [
  { id: 'tax_irvm_prev', name: 'Attestation IRVM — revenus de valeurs mobilières', year: NOW.getFullYear() - 1, available: true, url: '#' },
  { id: 'tax_interets_prev', name: 'Relevé annuel des intérêts — Épargne', year: NOW.getFullYear() - 1, available: true, url: '#' },
  { id: 'tax_crypto', name: 'Rapport de transactions crypto', year: NOW.getFullYear(), available: false },
]

// ---------- Transfer operators ----------

/**
 * Everywhere money can be sent from Keewal Meere.
 *
 * **The fees and limits here are demonstration values.** They are anchored to the orders
 * of magnitude these operators actually charge so the screen behaves plausibly, but they
 * are not a price list and no screen presents them as one — the picker says so.
 *
 * The list is deliberately West-Africa-first and mixes three different things people lump
 * together as "transfer": mobile money (a phone number is the account), remittance (cash
 * at a counter, the diaspora's rail), and online wallets. They are grouped rather than
 * ranked, because which one is right depends entirely on where the recipient is standing.
 */
export const seedTransferProviders: TransferProvider[] = [
  // Mobile money — the phone number is the account.
  { id: 'wave', mark: 'WAV', name: 'Wave', family: 'mobile_money', handle: 'phone', reach: 'Sénégal, Côte d’Ivoire, Mali, Burkina Faso, Ouganda', currency: 'XOF', feePct: 0.01, eta: 'Instantané', etaMinutes: 1, limitPerDay: 2_000_000, available: true },
  { id: 'orange', mark: 'OM', name: 'Orange Money', family: 'mobile_money', handle: 'phone', reach: 'Sénégal, Côte d’Ivoire, Mali, Cameroun, Guinée', currency: 'XOF', feePct: 0.015, eta: 'Instantané', etaMinutes: 1, limitPerDay: 1_500_000, available: true },
  { id: 'mtn', mark: 'MTN', name: 'MTN MoMo', family: 'mobile_money', handle: 'phone', reach: 'Côte d’Ivoire, Ghana, Cameroun, Nigeria, Ouganda', currency: 'XOF', feePct: 0.015, eta: 'Instantané', etaMinutes: 2, limitPerDay: 1_500_000, available: true },
  { id: 'moov', mark: 'MOO', name: 'Moov Money', family: 'mobile_money', handle: 'phone', reach: 'Côte d’Ivoire, Bénin, Togo, Burkina Faso', currency: 'XOF', feePct: 0.015, eta: 'Instantané', etaMinutes: 2, limitPerDay: 1_000_000, available: true },
  { id: 'freemoney', mark: 'FM', name: 'Free Money', family: 'mobile_money', handle: 'phone', reach: 'Sénégal', currency: 'XOF', feePct: 0.012, eta: 'Instantané', etaMinutes: 2, limitPerDay: 1_000_000, available: true },
  { id: 'mpesa', mark: 'MP', name: 'M-Pesa', family: 'mobile_money', handle: 'phone', reach: 'Kenya, Tanzanie, RDC', currency: 'KES', feePct: 0.012, eta: 'Instantané', etaMinutes: 2, limitPerDay: 500_000, available: false, note: 'Connexion en cours' },

  // Wallets and neobanks — an account, a tag or an email.
  { id: 'djamo', mark: 'DJ', name: 'Djamo', family: 'wallet', handle: 'phone', reach: 'Côte d’Ivoire, Sénégal', currency: 'XOF', feePct: 0.008, eta: 'Instantané', etaMinutes: 1, limitPerDay: 1_000_000, available: true },
  { id: 'revolut', mark: 'REV', name: 'Revolut', family: 'wallet', handle: 'tag', reach: 'Europe, Royaume-Uni, États-Unis', currency: 'EUR', feePct: 0.005, eta: 'Quelques minutes', etaMinutes: 10, limitPerDay: 5_000, available: true },
  { id: 'wise', mark: 'WIS', name: 'Wise', family: 'wallet', handle: 'email', reach: 'International', currency: 'EUR', feePct: 0.006, eta: '1 jour ouvrable', etaMinutes: 1_440, limitPerDay: 10_000, available: true },
  { id: 'paypal', mark: 'PP', name: 'PayPal', family: 'wallet', handle: 'email', reach: 'International', currency: 'EUR', feePct: 0.019, eta: 'Instantané', etaMinutes: 5, limitPerDay: 3_000, available: false, note: 'Connexion en cours' },

  // Remittance — the recipient collects cash at a counter.
  { id: 'moneygram', mark: 'MG', name: 'MoneyGram', family: 'remittance', handle: 'account', reach: 'Retrait en espèces, plus de 200 pays', currency: 'XOF', feePct: 0.025, feeFixed: 500, eta: 'Quelques minutes', etaMinutes: 15, limitPerDay: 3_000_000, available: true },
  { id: 'westernunion', mark: 'WU', name: 'Western Union', family: 'remittance', handle: 'account', reach: 'Retrait en espèces, plus de 200 pays', currency: 'XOF', feePct: 0.028, feeFixed: 500, eta: 'Quelques minutes', etaMinutes: 15, limitPerDay: 3_000_000, available: true },
  { id: 'ria', mark: 'RIA', name: 'Ria', family: 'remittance', handle: 'account', reach: 'Retrait en espèces, Afrique de l’Ouest', currency: 'XOF', feePct: 0.022, feeFixed: 400, eta: '30 minutes', etaMinutes: 30, limitPerDay: 2_000_000, available: true },

  // Bank rails.
  { id: 'interac', mark: 'INT', name: 'Interac e-Transfer', family: 'bank', handle: 'email', reach: 'Canada', currency: 'EUR', feePct: 0, eta: 'Quelques minutes', etaMinutes: 15, limitPerDay: 3_000, available: true, note: 'Pour la diaspora au Canada' },
  { id: 'sepa', mark: 'SEP', name: 'Virement SEPA', family: 'bank', handle: 'account', reach: 'Zone euro', currency: 'EUR', feePct: 0, eta: '1 à 2 jours ouvrables', etaMinutes: 1_440, limitPerDay: 20_000, available: true },
]

