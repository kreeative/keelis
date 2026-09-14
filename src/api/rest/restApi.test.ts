/**
 * The REST client is the half of "brancher les clés" that exists today, so it is the half
 * that has to be provably right before a backend exists to try it against. These tests
 * stand in a fake `fetch` and assert what actually goes on the wire — method, path, query,
 * body, headers — and, more importantly, what comes back out of a failure: the screens
 * branch on `ApiError.code`, and a wrong code there is a wrong sentence in front of
 * someone's money.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createRestApi } from './restApi'
import { setToken, getToken } from './http'
import { ApiError } from '../types'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

let calls: Call[] = []

/** A fetch that records the request and returns whatever the test queued. */
function fakeFetch(responses: Array<{ status?: number; body?: unknown; throws?: Error }>): typeof fetch {
  let i = 0
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = responses[Math.min(i, responses.length - 1)] ?? {}
    i += 1
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (req.throws) throw req.throws
    const status = req.status ?? 200
    const text = req.body === undefined ? '' : JSON.stringify(req.body)
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as Response
  }) as typeof fetch
}

function apiWith(responses: Array<{ status?: number; body?: unknown; throws?: Error }>) {
  return createRestApi({ baseUrl: 'https://api.example.test/v1', fetchFn: fakeFetch(responses) })
}

/** Await a call that must reject, and hand back the error rather than a union with it. */
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    return e as ApiError
  }
  throw new Error('expected the call to reject')
}

beforeEach(() => {
  calls = []
  localStorage.clear()
  setToken(null)
})

describe('requests', () => {
  it('joins the base URL and the path without doubling the slash', async () => {
    const api = createRestApi({ baseUrl: 'https://api.example.test/v1/', fetchFn: fakeFetch([{ body: [] }]) })
    await api.accounts.list()
    expect(calls[0]?.url).toBe('https://api.example.test/v1/accounts')
  })

  it('puts only the set filter keys on the query string', async () => {
    const api = apiWith([{ body: [] }])
    await api.transactions.list({ accountId: 'acc_1', types: ['deposit', 'card'], query: 'wave', limit: 20 })
    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/v1/transactions')
    expect(url.searchParams.get('accountId')).toBe('acc_1')
    expect(url.searchParams.get('types')).toBe('deposit,card')
    expect(url.searchParams.get('q')).toBe('wave')
    expect(url.searchParams.get('limit')).toBe('20')
    // Unset keys are absent, not empty: `minAmount=` would read as "at least nothing".
    expect(url.searchParams.has('minAmount')).toBe(false)
    expect(url.searchParams.has('from')).toBe(false)
  })

  it('escapes an id rather than pasting it into the path', async () => {
    const api = apiWith([{ body: {} }])
    await api.accounts.get('acc/../admin')
    expect(calls[0]?.url).toBe('https://api.example.test/v1/accounts/acc%2F..%2Fadmin')
  })

  it('sends no Content-Type on a body-less POST', async () => {
    const api = apiWith([{ body: {} }])
    await api.transactions.requestReceipt('tx_1')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.headers['Content-Type']).toBeUndefined()
  })

  it('treats 204 as a successful void', async () => {
    const api = apiWith([{ status: 204 }])
    await expect(api.savings.goals.remove('goal_1')).resolves.toBeUndefined()
  })
})

describe('the session token', () => {
  it('is absent before sign-in, and sent on every call after it', async () => {
    const api = apiWith([
      { body: { ok: true, session: { token: 'tok_abc', user: {}, expiresAt: '' } } },
      { body: [] },
    ])
    await api.accounts.list().catch(() => {})
    expect(calls[0]?.headers.Authorization).toBeUndefined()

    calls = []
    const api2 = apiWith([
      { body: { ok: true, session: { token: 'tok_abc', user: {}, expiresAt: '' } } },
      { body: [] },
    ])
    await api2.auth.verifyCode('a@b.test', '246810')
    await api2.accounts.list()
    expect(calls[1]?.headers.Authorization).toBe('Bearer tok_abc')
  })

  it('is dropped when the server says the session is over', async () => {
    setToken('tok_stale')
    const api = apiWith([{ status: 401, body: { error: { code: 'unauthorized', message: 'expirée' } } }])
    await expect(api.accounts.list()).rejects.toBeInstanceOf(ApiError)
    // Keeping a token the server has rejected means every later call fails the same way
    // with no route back to the sign-in screen.
    expect(getToken()).toBeNull()
  })

  it('is dropped even when sign-out itself fails', async () => {
    setToken('tok_abc')
    const api = apiWith([{ status: 500 }])
    await expect(api.auth.signOut()).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })
})

describe('failures carry the code the screens branch on', () => {
  it('prefers the server’s own code over the status', async () => {
    // Only the server can tell "you do not have the money" apart from any other 409.
    const api = apiWith([{ status: 409, body: { error: { code: 'insufficient_funds', message: 'Solde insuffisant' } } }])
    const err = await failure(api.funding.addFunds({} as never))
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('insufficient_funds')
    expect(err.message).toBe('Solde insuffisant')
  })

  it('maps 422 to validation and keeps the per-field details', async () => {
    const api = apiWith([{ status: 422, body: { error: { message: 'IBAN invalide', details: { iban: 'Longueur incorrecte' } } } }])
    const err = await failure(api.transfers.send({} as never))
    expect(err.code).toBe('validation')
    expect(err.details?.iban).toBe('Longueur incorrecte')
  })

  it('maps a server fault to network, not to unknown', async () => {
    const api = apiWith([{ status: 503 }])
    const err = await failure(api.accounts.list())
    // `network` is the code that gets a Réessayer button; `unknown` gets a dead end.
    expect(err.code).toBe('network')
  })

  it('maps 429 to rate_limited', async () => {
    const api = apiWith([{ status: 429 }])
    const err = await failure(api.auth.requestCode('a@b.test'))
    expect(err.code).toBe('rate_limited')
  })

  it('ignores an unknown code the server invents', async () => {
    const api = apiWith([{ status: 400, body: { error: { code: 'teapot', message: 'non' } } }])
    const err = await failure(api.accounts.list())
    expect(err.code).toBe('unknown')
    expect(err.message).toBe('non')
  })

  it('survives an error body that is not JSON', async () => {
    const api = apiWith([{ status: 500, body: undefined }])
    const err = await failure(api.accounts.list())
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBeTruthy()
  })

  it('maps a dead socket to network', async () => {
    const api = apiWith([{ throws: new TypeError('Failed to fetch') }])
    const err = await failure(api.accounts.list())
    expect(err.code).toBe('network')
  })

  it('calls an offline device offline, without opening a socket', async () => {
    // jsdom defines onLine on the prototype, so the override has to be removed rather
    // than restored — leaving it behind would make every later test "offline".
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      const api = apiWith([{ body: [] }])
      const err = await failure(api.accounts.list())
      // Offline and network read differently to the user: one is fixed by waiting, and the
      // offline banner keeps the cached figures on screen meanwhile.
      expect(err.code).toBe('offline')
      expect(calls).toHaveLength(0)
    } finally {
      Reflect.deleteProperty(navigator, 'onLine')
    }
  })
})

describe('endpoint mapping', () => {
  const cases: Array<[string, (api: ReturnType<typeof apiWith>) => Promise<unknown>, string, string]> = [
    ['accounts.history', (a) => a.accounts.history('1M'), 'GET', '/v1/networth/history'],
    ['card.reveal', (a) => a.card.reveal(), 'POST', '/v1/card/reveal'],
    ['crypto.quote', (a) => a.crypto.quote({ assetId: 'btc', side: 'buy', mode: 'fiat', amount: 1 }), 'POST', '/v1/quotes'],
    ['crypto.placeOrder', (a) => a.crypto.placeOrder('q_1'), 'POST', '/v1/orders'],
    ['crypto.portfolioHistory', (a) => a.crypto.portfolioHistory('1Y'), 'GET', '/v1/portfolio/history'],
    ['savings.deposit', (a) => a.savings.deposit(100, 'acc_1'), 'POST', '/v1/savings/deposit'],
    ['transfers.providers', (a) => a.transfers.providers(), 'GET', '/v1/transfer-providers'],
    ['notifications.markAllRead', (a) => a.notifications.markAllRead(), 'PATCH', '/v1/notifications'],
    ['profile.taxDocuments', (a) => a.profile.taxDocuments(), 'GET', '/v1/me/tax-documents'],
  ]
  for (const [name, call, method, pathname] of cases) {
    it(`${name} → ${method} ${pathname}`, async () => {
      calls = []
      await call(apiWith([{ body: {} }]))
      expect(calls[0]?.method).toBe(method)
      expect(new URL(calls[0]!.url).pathname).toBe(pathname)
    })
  }
})
