/**
 * `docs/API.md` is the specification a back-end has to satisfy. A specification that drifts
 * from the client is worse than none: someone builds to it, and the app calls something
 * else. So the document is checked mechanically — every endpoint the client calls has to
 * appear in it, and every endpoint it documents has to be one the client actually calls.
 *
 * The second direction matters as much as the first. A documented endpoint nobody calls is
 * work commissioned for nothing.
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
