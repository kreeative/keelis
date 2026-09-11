import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/api/types'
import { EMPTY_FILTER, describeFilter, isEmptyFilter, narrow, toApiFilter, type FilterState } from './filters'

const NOW = new Date('2026-09-11T12:00:00')

function tx(patch: Partial<Transaction>): Transaction {
  return {
    id: 't',
    accountId: 'acc_chq_01',
    type: 'card',
    status: 'posted',
    amount: -10,
    currency: 'CAD',
    counterparty: 'Test',
    category: 'other',
    date: NOW.toISOString(),
    ...patch,
  }
}

const state = (patch: Partial<FilterState> = {}): FilterState => ({ ...EMPTY_FILTER, ...patch })

describe('isEmptyFilter', () => {
  it('is empty by default and not once a criterion is set', () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true)
    expect(isEmptyFilter(state({ types: ['card'] }))).toBe(false)
    expect(isEmptyFilter(state({ min: '20' }))).toBe(false)
    expect(isEmptyFilter(state({ period: '30' }))).toBe(false)
  })
})

describe('toApiFilter', () => {
  it('returns undefined when nothing is filtered, so the list reuses the patched cache entry', () => {
    expect(toApiFilter(EMPTY_FILTER, '', NOW)).toBeUndefined()
    expect(toApiFilter(EMPTY_FILTER, '   ', NOW)).toBeUndefined()
  })

  it('sends the union of the selected chips as a superset of types', () => {
    const f = toApiFilter(state({ types: ['etransfer', 'refunds'] }), '', NOW)
    expect(f?.types).toEqual(['etransfer_in', 'etransfer_out', 'refund'])
  })

  it('reads locale amounts and keeps the period as a stable day boundary', () => {
    const f = toApiFilter(state({ min: '1 200,50', max: '2 000', period: '7' }), 'épicerie', NOW)
    expect(f?.minAmount).toBe(1200.5)
    expect(f?.maxAmount).toBe(2000)
    expect(f?.query).toBe('épicerie')
    expect(new Date(f!.from!).getTime()).toBe(new Date(2026, 8, 5).getTime())
  })

  it('ignores amounts that are not usable numbers', () => {
    expect(toApiFilter(state({ min: 'abc' }), '', NOW)).toBeUndefined()
    expect(toApiFilter(state({ min: '-5' }), '', NOW)).toBeUndefined()
  })
})

describe('narrow', () => {
  const savings = tx({ type: 'transfer_out', category: 'savings', counterparty: 'Vers Épargne' })
  const crypto = tx({ type: 'transfer_out', category: 'crypto', counterparty: 'Vers Crypto' })
  const wire = tx({ type: 'transfer_out', category: 'transfer', counterparty: 'Loyer' })
  const card = tx({ type: 'card', category: 'groceries' })
  const list = [savings, crypto, wire, card]

  it('leaves the list untouched when no chip is selected', () => {
    expect(narrow(list, EMPTY_FILTER)).toBe(list)
  })

  it('keeps « Virements » to real transfers, excluding the savings and crypto legs', () => {
    expect(narrow(list, state({ types: ['transfers'] }))).toEqual([wire])
  })

  it('resolves a mixed selection to the exact union of the chips', () => {
    expect(narrow(list, state({ types: ['savings', 'card'] }))).toEqual([savings, card])
  })
})

describe('describeFilter', () => {
  const money = (n: number) => `${n} $`

  it('describes one badge per active criterion', () => {
    expect(describeFilter(state({ types: ['card'], min: '20', max: '100', period: '90' }), money)).toEqual(['Carte', '20 $ à 100 $', '90 derniers jours'])
  })

  it('describes open-ended amount ranges', () => {
    expect(describeFilter(state({ min: '20' }), money)).toEqual(['20 $ et plus'])
    expect(describeFilter(state({ max: '100' }), money)).toEqual(['100 $ et moins'])
  })

  it('says nothing when nothing is filtered', () => {
    expect(describeFilter(EMPTY_FILTER, money)).toEqual([])
  })
})
