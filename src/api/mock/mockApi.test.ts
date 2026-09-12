import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetMockState, mockApi, mockControls } from './mockApi'
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
    expect(q.total).toBe(100)
    expect(q.executionPrice).toBeGreaterThan(q.marketPrice)
    expect(q.spreadPct).toBe(0.015)
    expect(q.spreadAmount).toBeGreaterThan(0)
    expect(q.quantity * q.executionPrice).toBeCloseTo(100, 6)
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
    expect(after).toBeCloseTo(before - 50, 2)
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
    await expect(mockApi.accounts.list()).resolves.toHaveLength(3)
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
    const q = await mockApi.transactions.list({ query: 'beaubien' })
    expect(q.length).toBeGreaterThan(0)
  })
})

describe('auth', () => {
  it('opens a session for the demo user with the demo code', async () => {
    await mockApi.auth.requestCode('aissatou.ndiaye@exemple.ca')
    const r = await mockApi.auth.verifyCode('aissatou.ndiaye@exemple.ca', '246810')
    expect(r.session?.user.firstName).toBe('Aïssatou')
    expect(await mockApi.auth.getSession()).not.toBeNull()
    await mockApi.auth.signOut()
    expect(await mockApi.auth.getSession()).toBeNull()
  })
  it('rejects wrong codes', async () => {
    await mockApi.auth.requestCode('new@exemple.ca')
    await expect(mockApi.auth.verifyCode('new@exemple.ca', '000000')).rejects.toMatchObject({ code: 'validation' })
  })
  it('verifies the PIN', async () => {
    await mockApi.auth.setPin('4321')
    expect((await mockApi.auth.verifyPin('4321')).ok).toBe(true)
    expect((await mockApi.auth.verifyPin('1234')).ok).toBe(false)
  })
  vi.useRealTimers()
})
