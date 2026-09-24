import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __advancePrices, __resetMockState, __setFxRates, __setMarketPrices, __setMarketSeries, mockApi, mockControls } from './mockApi'
import { IDS } from './seed'
import { ApiError } from '../types'

beforeEach(() => {
  localStorage.clear()
  __resetMockState()
  mockControls.latency = [0, 0]
  mockControls.offline = false
  mockControls.failNext = 0
  mockControls.settleMs = 20
})

describe('crypto quotes', () => {
  it('applies the spread explicitly on a buy', async () => {
    const q = await mockApi.crypto.quote({ assetId: 'btc', side: 'buy', mode: 'fiat', amount: 100 })
    expect(q.executionPrice).toBeGreaterThan(q.marketPrice)
    expect(q.spreadPct).toBe(0.015)
    expect(q.spreadAmount).toBeGreaterThan(0)
    // The total is what is actually bought, not what was typed. Bitcoin is divisible to
    // the satoshi and no further, so a buy lands on a whole number of them and the dust
    // that does not reach the next one is not charged: at most one satoshi's worth.
    expect(q.total).toBeLessThanOrEqual(100)
    expect(q.total).toBeGreaterThan(100 - q.executionPrice * 1e-8 - 0.01)
    expect(q.quantity * q.executionPrice).toBeCloseTo(q.total, 2)
  })
  it('rejects buys above the checking balance', async () => {
    // Derived from the balance, not a literal: "more than the account holds" is the thing
    // under test, and a hardcoded figure silently stopped being one when the demo moved
    // from dollars to CFA francs.
    const balance = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!.balance
    await expect(mockApi.crypto.quote({ assetId: 'btc', side: 'buy', mode: 'fiat', amount: balance * 2 })).rejects.toMatchObject({ code: 'insufficient_funds' })
  })
  it('rejects sells above holdings', async () => {
    await expect(mockApi.crypto.quote({ assetId: 'btc', side: 'sell', mode: 'crypto', amount: 10 })).rejects.toMatchObject({ code: 'insufficient_funds' })
  })
  it('places an order as pending, then settles', async () => {
    const events: string[] = []
    const off = mockApi.subscribe((e) => events.push(e.type === 'transaction' ? `tx:${e.transaction.status}` : e.type))
    const before = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!.balance
    const q = await mockApi.crypto.quote({ assetId: 'eth', side: 'buy', mode: 'fiat', amount: 50 })
    const order = await mockApi.crypto.placeOrder(q.id)
    expect(order.status).toBe('pending')
    const after = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!.balance
    // Against the quote's own total, not the amount typed: the two differ by the dust that
    // does not reach a whole unit of the asset, and the account is debited what it bought.
    expect(after).toBeCloseTo(before - q.total, 2)
    expect(events).toContain('tx:pending')
    await new Promise((r) => setTimeout(r, 60))
    expect(events).toContain('tx:posted')
    const tx = await mockApi.transactions.get(order.transactionId)
    expect(tx.status).toBe('posted')
    off()
  })
  it('refuses a reused quote', async () => {
    const q = await mockApi.crypto.quote({ assetId: 'eth', side: 'buy', mode: 'fiat', amount: 20 })
    await mockApi.crypto.placeOrder(q.id)
    await expect(mockApi.crypto.placeOrder(q.id)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('savings', () => {
  it('moves money between checking and savings', async () => {
    const s0 = await mockApi.savings.summary()
    await mockApi.savings.deposit(100, IDS.checking)
    const s1 = await mockApi.savings.summary()
    expect(s1.balance).toBeCloseTo(s0.balance + 100, 2)
    await expect(mockApi.savings.withdraw(s1.balance * 2, IDS.checking)).rejects.toMatchObject({ code: 'insufficient_funds' })
  })
  it('caps goal allocations to the savings balance', async () => {
    const savings = (await mockApi.savings.summary()).balance
    await expect(mockApi.savings.goals.create({ name: 'Trop', target: 1000, monthlyContribution: 10, initialDeposit: savings * 2 })).rejects.toMatchObject({ code: 'insufficient_funds' })
    const g = await mockApi.savings.goals.create({ name: 'Vélo', target: 800, monthlyContribution: 100, initialDeposit: 50 })
    expect(g.current).toBe(50)
    expect((await mockApi.savings.goals.list()).length).toBe(3)
  })
})

describe('failure modes', () => {
  it('surfaces offline errors', async () => {
    mockControls.offline = true
    await expect(mockApi.accounts.list()).rejects.toMatchObject({ code: 'offline' })
  })
  it('surfaces forced network failures once', async () => {
    mockControls.failNext = 1
    await expect(mockApi.accounts.list()).rejects.toMatchObject({ code: 'network' })
    // Four: Chèque, Épargne, Actifs and Crypto — the last two were one account until the
    // owner asked for crypto to stand on its own.
    await expect(mockApi.accounts.list()).resolves.toHaveLength(4)
  })
})

describe('seed', () => {
  it('has ~60 transactions over 3 months, both asset classes, 2 goals', async () => {
    const txs = await mockApi.transactions.list()
    expect(txs.length).toBeGreaterThanOrEqual(60)
    const oldest = txs[txs.length - 1]!
    expect(Date.now() - new Date(oldest.date).getTime()).toBeLessThan(92 * 86_400_000)
    // The demo leads with African equities and keeps the coins beside them, so assert the
    // split rather than a total — a bare count would break again the next time either
    // list grows, and would not have caught an empty equity list.
    const assets = await mockApi.crypto.listAssets()
    expect(assets.filter((a) => a.assetClass === 'equity').length).toBe(7)
    expect(assets.filter((a) => a.assetClass === 'crypto').length).toBe(8)
    expect((await mockApi.savings.goals.list()).length).toBe(2)
  })
  it('filters transactions', async () => {
    const card = await mockApi.transactions.list({ types: ['card'], accountId: IDS.checking })
    expect(card.every((t) => t.type === 'card')).toBe(true)
    // Accent- and case-insensitive search over the counterparty: « kermel » has to find
    // « Marché Kermel ». The merchant list is Dakar's, so the term is too.
    const q = await mockApi.transactions.list({ query: 'kermel' })
    expect(q.length).toBeGreaterThan(0)
    expect(q.every((t) => t.counterparty.toLowerCase().includes('kermel'))).toBe(true)
  })
})

describe('auth', () => {
  it('opens a session for the demo user with the demo code', async () => {
    await mockApi.auth.requestCode('aissatou.ndiaye@exemple.sn')
    const r = await mockApi.auth.verifyCode('aissatou.ndiaye@exemple.sn', '246810')
    expect(r.session?.user.firstName).toBe('Aïssatou')
    expect(await mockApi.auth.getSession()).not.toBeNull()
    await mockApi.auth.signOut()
    expect(await mockApi.auth.getSession()).toBeNull()
  })
  it('rejects wrong codes', async () => {
    await mockApi.auth.requestCode('new@exemple.sn')
    await expect(mockApi.auth.verifyCode('new@exemple.sn', '000000')).rejects.toMatchObject({ code: 'validation' })
  })
  it('verifies the PIN', async () => {
    await mockApi.auth.setPin('4321')
    expect((await mockApi.auth.verifyPin('4321')).ok).toBe(true)
    expect((await mockApi.auth.verifyPin('1234')).ok).toBe(false)
  })
  vi.useRealTimers()
})

describe('an indivisible asset', () => {
  it('quotes whole shares, and charges only for them', async () => {
    // A share of Sonatel cannot be split on the BRVM, and the asset says so itself with
    // `decimals: 0`. The quote used to divide the amount by the price and hand back
    // « 1.6976 SNTS » — a quantity no exchange would accept.
    const q = await mockApi.crypto.quote({ assetId: 'sonatel', side: 'buy', mode: 'fiat', amount: 50_000 })
    expect(Number.isInteger(q.quantity)).toBe(true)
    expect(q.quantity).toBe(1)
    // The total is what actually leaves the account, not what was typed: the francs that
    // do not buy a whole share are not spent.
    expect(q.total).toBeLessThan(50_000)
    expect(q.total).toBeCloseTo(q.quantity * q.executionPrice, 2)
  })

  it('rounds down rather than up, so nobody is charged for more than they asked', async () => {
    const q = await mockApi.crypto.quote({ assetId: 'sonatel', side: 'buy', mode: 'fiat', amount: 59_000 })
    // 59 000 buys two shares at ~29 450 and leaves the rest unspent; it must never round
    // up to a third and take more than was offered.
    expect(q.quantity).toBe(2)
    expect(q.total).toBeLessThanOrEqual(59_000)
    expect(q.total).toBeGreaterThan(58_000)
  })

  it('refuses an amount that does not reach one share, and says the price', async () => {
    const err = await mockApi.crypto
      .quote({ assetId: 'sonatel', side: 'buy', mode: 'fiat', amount: 5_000 })
      .catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('validation')
    // Its own sentence: "montant invalide" would not tell anyone how much is needed.
    expect((err as ApiError).message).toMatch(/cote/)
  })

  it('still lets bitcoin be bought in fractions', async () => {
    const q = await mockApi.crypto.quote({ assetId: 'btc', side: 'buy', mode: 'fiat', amount: 25_000 })
    expect(q.quantity).toBeGreaterThan(0)
    expect(Number.isInteger(q.quantity)).toBe(false)
  })
})

describe('sending through an operator', () => {
  const wave = (over: Record<string, unknown> = {}) => ({
    fromAccountId: IDS.checking,
    method: 'operator' as const,
    providerId: 'wave',
    recipient: { name: 'Amina Diallo', handle: '+221 77 555 01 48' },
    amount: 25_000,
    ...over,
  })

  it('accepts a phone number on a Mobile Money rail', async () => {
    // This was refused as « Courriel du destinataire invalide » — the back-end validated
    // every handle as an email, whatever rail the money was going out on.
    const r = await mockApi.transfers.send(wave())
    expect(r.status).toBe('pending')
  })

  it('charges the operator’s fee and says what it was', async () => {
    const before = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!.balance
    const r = await mockApi.transfers.send(wave())
    // Wave takes 1 %. The fee was reported as zero and never debited.
    expect(r.fee).toBe(250)
    const after = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!.balance
    expect(after).toBeCloseTo(before - 25_250, 2)
  })

  it('refuses an email where the rail wants a phone number', async () => {
    await expect(mockApi.transfers.send(wave({ recipient: { name: 'A', handle: 'nom@exemple.sn' } }))).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses to send through an operator that is not connected', async () => {
    // M-Pesa is listed but not yet wired up. Listing it is honest; pretending is not.
    await expect(mockApi.transfers.send(wave({ providerId: 'mpesa' }))).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses a transfer with no operator at all', async () => {
    await expect(mockApi.transfers.send(wave({ providerId: undefined }))).rejects.toMatchObject({ code: 'validation' })
  })
})

describe('converting between currencies', () => {
  it('moves money out of one pocket and into another', async () => {
    // « Confirmer » used to close a sheet, show a toast reading « converti », and move
    // nothing at all — no balance, no transaction. The app told somebody their money had
    // moved when it had not, which is the one thing a money product may never do.
    const before = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!
    const euroBefore = before.pockets?.find((p) => p.currency === 'EUR')?.amount ?? 0

    const r = await mockApi.fx.convert({ accountId: IDS.checking, from: 'XOF', to: 'EUR', amount: 100_000 })

    const after = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!
    expect(after.balance).toBe(before.balance - 100_000)
    expect(after.pockets?.find((p) => p.currency === 'EUR')?.amount).toBeGreaterThan(euroBefore)
    // One African leg: 1.2 % of what was sold, in what was sold.
    expect(r.fee).toBe(1_200)
  })

  it('records both legs, each in its own currency', async () => {
    await mockApi.fx.convert({ accountId: IDS.checking, from: 'XOF', to: 'EUR', amount: 50_000 })
    const txs = await mockApi.transactions.list({ accountId: IDS.checking, limit: 4 })
    const out = txs.find((t) => t.counterparty.includes('vers EUR'))
    const back = txs.find((t) => t.counterparty.includes('depuis XOF'))
    // A single row could only show one side of a conversion.
    expect(out?.currency).toBe('XOF')
    expect(back?.currency).toBe('EUR')
    expect(out?.amount).toBe(-50_000)
  })

  it('refuses to sell a currency the account does not hold enough of', async () => {
    await expect(mockApi.fx.convert({ accountId: IDS.checking, from: 'NGN', to: 'XOF', amount: 10_000_000 })).rejects.toMatchObject({ code: 'insufficient_funds' })
  })

  it('refuses a conversion into the same currency', async () => {
    await expect(mockApi.fx.convert({ accountId: IDS.checking, from: 'XOF', to: 'XOF', amount: 1_000 })).rejects.toMatchObject({ code: 'validation' })
  })

  it('drops a pocket once it is emptied', async () => {
    const account = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!
    const naira = account.pockets!.find((p) => p.currency === 'NGN')!.amount
    await mockApi.fx.convert({ accountId: IDS.checking, from: 'NGN', to: 'XOF', amount: naira })
    const after = (await mockApi.accounts.list()).find((a) => a.id === IDS.checking)!
    // Fifteen zero balances would be a filing cabinet, not a wallet.
    expect(after.pockets?.some((p) => p.currency === 'NGN')).toBe(false)
  })
})

describe('what a feed writes in', () => {
  it('replaces a price, names its source, and leaves the ticker off it', async () => {
    const before = (await mockApi.crypto.getAsset('btc')).price
    __setMarketPrices([{ id: 'btc', price: 40_000_000, change24hPct: 2 }], { provider: 'CoinGecko', updatedAt: '2026-09-23T10:00:00.000Z' })
    const btc = await mockApi.crypto.getAsset('btc')
    expect(btc.price).toBe(40_000_000)
    expect(btc.priceSource).toEqual({ provider: 'CoinGecko', updatedAt: '2026-09-23T10:00:00.000Z' })
    expect(btc.change24hPct).toBe(2)
    expect(before).not.toBe(40_000_000)
    // The random walk must not drift a real figure between two reads — and it still walks
    // the ones no feed covers, so the demonstration stays alive.
    const sonatelBefore = (await mockApi.crypto.getAsset('sonatel')).price
    __advancePrices()
    expect((await mockApi.crypto.getAsset('btc')).price).toBe(40_000_000)
    expect((await mockApi.crypto.getAsset('sonatel')).price).not.toBe(sonatelBefore)
    expect((await mockApi.crypto.getAsset('sonatel')).priceSource).toBeUndefined()
  })

  it('refuses a price of nothing and an unknown id', async () => {
    const before = (await mockApi.crypto.getAsset('eth')).price
    __setMarketPrices([{ id: 'eth', price: 0, change24hPct: 1 }, { id: 'nope', price: 5, change24hPct: 1 }], { provider: 'X', updatedAt: 'now' })
    const eth = await mockApi.crypto.getAsset('eth')
    expect(eth.price).toBe(before)
    expect(eth.priceSource).toBeUndefined()
  })

  it('serves a real series in place of the generated one, and derives the sparkline from 1D', async () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ t: 1_700_000_000_000 + i * 60_000, p: 100 + i }))
    __setMarketSeries('btc', '1D', pts)
    const h = await mockApi.crypto.history('btc', '1D')
    expect(h.points).toHaveLength(50)
    expect(h.change).toBe(49)
    const btc = await mockApi.crypto.getAsset('btc')
    expect(btc.sparkline).toHaveLength(24)
    expect(btc.sparkline[0]).toBe(100)
    expect(btc.sparkline[23]).toBe(149)
    // Another range is still generated: the feed wrote one range in, not all of them.
    expect((await mockApi.crypto.history('btc', '1W')).points.length).not.toBe(50)
  })

  it('quotes conversions from the live table, with the pegs pinned', async () => {
    expect((await mockApi.fx.rates()).live).toBe(false)
    __setFxRates({ NGN: 2000, XOF: 655.96 }, 'ExchangeRate-API', '2026-09-23T00:00:00.000Z')
    const r = await mockApi.fx.rates()
    expect(r.live).toBe(true)
    expect(r.provider).toBe('ExchangeRate-API')
    expect(r.perEur.NGN).toBe(2000)
    expect(r.perEur.XOF).toBe(655.957)
    // 655 957 F CFA is exactly 1 000 €; at 2 000 naira to the euro, the mid is 2 000 000.
    const res = await mockApi.fx.convert({ accountId: IDS.checking, from: 'XOF', to: 'NGN', amount: 655_957 })
    const tx = (await mockApi.transactions.list({ accountId: IDS.checking, limit: 5 })).find((t) => t.currency === 'NGN')
    expect(tx?.amount).toBe(2_000_000 * (1 - 0.018))
    expect(res.fee).toBe(Math.round(655_957 * 0.018))
  })

  it('is cleared by a reset', async () => {
    __setFxRates({ NGN: 2000 }, 'X')
    __resetMockState()
    expect((await mockApi.fx.rates()).live).toBe(false)
    expect((await mockApi.market.sources()).every((s) => s.status === 'demo')).toBe(true)
  })
})
