/**
 * Runs the app under the exact Content-Security-Policy it is deployed with.
 *
 * A CSP that has never been exercised is a CSP that breaks the application the day it ships
 * — a blocked font, a blocked data: URI, a blocked style attribute — and it breaks it for
 * everyone at once. So the policy is read out of `vercel.json` rather than retyped here,
 * injected on the document response, and the screens are walked with every violation
 * treated as a failure.
 *
 * Usage: node e2e/csp.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const ROUTES = ['/', '/crypto', '/crypto/btc', '/carte', '/carte/details', '/apprendre', '/epargne', '/convertir', '/envoyer', '/envoyer/operateurs', '/fonds', '/profil', '/profil/donnees', '/profil/risque', '/notifications', '/entreprise', '/bienvenue', '/crypto/btc/recevoir']

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium')) continue
    for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome']) {
      const p = join(root, dir, c)
      if (existsSync(p) && statSync(p).isFile()) return p
    }
  }
  return undefined
}

/** The policy as deployed — read from the file that deploys it, never retyped. */
function deployedCsp() {
  const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const rule of cfg.headers ?? []) {
    const header = (rule.headers ?? []).find((h) => h.key.toLowerCase() === 'content-security-policy')
    if (header) return header.value
  }
  throw new Error('vercel.json declares no Content-Security-Policy')
}

/**
 * Every inline script in the built page has to be named in the policy by its hash.
 *
 * The theme bootstrap has to be inline and blocking to beat the first paint, and allowing
 * inline script in general to accommodate it would give up most of what a CSP is for. A
 * hash is the right answer and the wrong thing to maintain by hand — change the script and
 * the page silently stops applying the theme in production. So it is recomputed here from
 * the build, and the check fails with the value to paste.
 */
function checkInlineHashes(policy) {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
  const missing = []
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const hash = 'sha256-' + createHash('sha256').update(m[1], 'utf8').digest('base64')
    if (!policy.includes(hash)) missing.push(hash)
  }
  return missing
}

const csp = deployedCsp()
const missingHashes = checkInlineHashes(csp)
if (missingHashes.length) {
  console.error(
    `The deployed Content-Security-Policy does not allow every inline script in dist/index.html.\n` +
      `Add to script-src in vercel.json:\n` +
      missingHashes.map((h) => `  '${h}'`).join('\n'),
  )
  process.exit(1)
}
const executablePath = findChromium()
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const violations = []

const DEMO_SESSION = {
  user: { id: 'usr_01', firstName: 'Aïssatou', lastName: 'Ndiaye', email: 'aissatou.ndiaye@exemple.sn', verified: true, twoFactorEnabled: true, biometricsEnabled: false, pinSet: true, locale: 'fr-SN', createdAt: new Date().toISOString() },
  token: 'e2e',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  if (route !== '/bienvenue') {
    await page.addInitScript((s) => localStorage.setItem('keewal.session', s), JSON.stringify(DEMO_SESSION))
  }
  // Inject the policy on the document, the way the CDN will.
  await page.route('**/*', async (r) => {
    const response = await r.fetch()
    const headers = { ...response.headers() }
    if ((headers['content-type'] ?? '').includes('text/html')) headers['content-security-policy'] = csp
    await r.fulfill({ response, headers })
  })
  page.on('console', (m) => {
    const text = m.text()
    if (/Content Security Policy|Refused to/i.test(text)) violations.push(`${route}: ${text.replace(/\s+/g, ' ').slice(0, 200)}`)
  })
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
  } catch (e) {
    violations.push(`${route}: ${e.message.split('\n')[0]}`)
  }
  await page.close()
}
await browser.close()

if (violations.length) {
  console.error(`CSP violations (${violations.length}):\n` + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
}
console.log(`CSP clean: ${ROUTES.length} routes under the deployed policy.`)
