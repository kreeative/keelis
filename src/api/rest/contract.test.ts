/**
 * `docs/API.md` is the specification a back-end has to satisfy. A specification that drifts
 * from the client is worse than none: someone builds to it, and the app calls something
 * else. So the document is checked mechanically — every endpoint the client calls has to
 * appear in it, and every endpoint it documents has to be one the client actually calls.
 *
 * The second direction matters as much as the first. A documented endpoint nobody calls is
 * work commissioned for nothing.
 *
 * And a third party has to agree with both: `server/reference.mjs` is the back-end the whole
 * app is driven against by `pnpm e2e:server`. That walk only exercises the handful of paths
 * it visits, so a route could quietly disappear from the reference server and nothing would
 * notice — leaving the one thing that proves the contract is implementable proving it for
 * two thirds of the contract.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../..')

/** Endpoints the client calls, with interpolated ids collapsed to `:id`. */
function endpointsInClient(): string[] {
  const src = readFileSync(join(ROOT, 'src/api/rest/restApi.ts'), 'utf8')
  const re = /http\.(get|post|patch|del)(?:<[^(]*?>)?\(\s*[`'](.*?)[`']/g
  const found = new Set<string>()
  for (const m of src.matchAll(re)) {
    const method = m[1] === 'del' ? 'DELETE' : m[1]!.toUpperCase()
    found.add(`${method} ${m[2]!.replace(/\$\{[^}]*\}/g, ':id')}`)
  }
  return [...found]
}

/** Endpoints the document lists, read out of its `| METHOD | \`/path\` |` table rows. */
function endpointsInDoc(): string[] {
  const doc = readFileSync(join(ROOT, 'docs/API.md'), 'utf8')
  const re = /^\|\s*(GET|POST|PATCH|DELETE)\s*\|\s*`([^`]+)`/gm
  const found = new Set<string>()
  for (const m of doc.matchAll(re)) {
    // The table documents the query string inline; the comparison is on the path alone.
    const path = m[2]!.split('?')[0]!.trim()
    found.add(`${m[1]} ${path}`)
  }
  return [...found]
}

/** Endpoints the reference back-end serves, read out of its route table. */
function endpointsInServer(): string[] {
  const src = readFileSync(join(ROOT, 'server/reference.mjs'), 'utf8')
  const re = /^\s*\['(GET|POST|PATCH|DELETE)',\s*'([^']+)'/gm
  const found = new Set<string>()
  for (const m of src.matchAll(re)) {
    // The server names its parameters (`/accounts/:id`, `/assets/:symbol`); the document
    // and the client collapse every one of them to `:id`. Compare on shape.
    found.add(`${m[1]} ${m[2]!.replace(/:[A-Za-z]+/g, ':id')}`)
  }
  return [...found]
}

describe('docs/API.md and the REST client agree', () => {
  it('documents every endpoint the client calls', () => {
    const doc = new Set(endpointsInDoc())
    const missing = endpointsInClient().filter((e) => !doc.has(e))
    expect(missing).toEqual([])
  })

  it('documents nothing the client does not call', () => {
    const client = new Set(endpointsInClient())
    const extra = endpointsInDoc().filter((e) => !client.has(e))
    expect(extra).toEqual([])
  })

  it('is implemented in full by the reference back-end', () => {
    const server = new Set(endpointsInServer())
    const unserved = endpointsInDoc()
      .map((e) => e.replace(/:[A-Za-z]+/g, ':id'))
      // The event stream is not a route: it is a long-lived response the server handles
      // before the table, because it never ends and never returns JSON.
      .filter((e) => e !== 'GET /events')
      .filter((e) => !server.has(e))
    expect(unserved).toEqual([])
  })

  it('is counted correctly everywhere the count is written down', () => {
    // Three documents quoted three different numbers for one countable fact — 62, 63 and
    // the server's own log line. A number written into prose is a claim with nothing
    // keeping it true.
    const n = endpointsInDoc().length
    for (const file of ['README.md', 'ROADMAP.md']) {
      const text = readFileSync(join(ROOT, file), 'utf8')
      const claimed = [...text.matchAll(/(\d+) points d’entrée|(\d+) points d'entrée/g)].map((m) => Number(m[1] ?? m[2]))
      expect(claimed.length, `${file} should state the endpoint count`).toBeGreaterThan(0)
      for (const c of claimed) expect(c, `${file} claims ${c} endpoints; docs/API.md lists ${n}`).toBe(n)
    }
  })

  it('has no route where a literal segment sits where a parameter can', () => {
    // The ambiguity this catches — `/orders/quote` beside `/orders/:id` — works until the
    // second route exists, then depends on a framework's declaration order.
    const paths = [...new Set([...endpointsInClient(), ...endpointsInDoc()].map((e) => e.split(' ')[1]!))]
    const ambiguous: string[] = []
    for (const a of paths) {
      const sa = a.split('/')
      for (const b of paths) {
        if (a === b) continue
        const sb = b.split('/')
        if (sa.length !== sb.length) continue
        let conflict = false
        let ok = true
        for (let i = 0; i < sa.length; i += 1) {
          const x = sa[i]!
          const y = sb[i]!
          if (x === y) continue
          if (x === ':id' || y === ':id') conflict = true
          else {
            ok = false
            break
          }
        }
        if (ok && conflict) ambiguous.push(`${a} vs ${b}`)
      }
    }
    expect(ambiguous).toEqual([])
  })
})
