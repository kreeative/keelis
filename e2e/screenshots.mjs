#!/usr/bin/env node
/**
 * Visual + runtime audit. Builds nothing itself: expects the app served at BASE_URL
 * (default http://localhost:4173, i.e. `pnpm build && pnpm preview`).
 *
 * For each route × viewport × theme it:
 *  - screenshots to e2e/out/<route>-<width>-<theme>.png
 *  - audits: horizontal overflow, text < 12px, tap targets < 44px, WCAG contrast, and
 *    any sticky control left sitting under the floating navigation pill
 *    (< 4.5:1 for text, < 3:1 for ≥24px text), computed against the real composited
 *    background — translucent glass surfaces are blended down to the ground colour
 *
 * Usage: node e2e/screenshots.mjs [--routes=/,/crypto] [--widths=390,1440] [--themes=light,dark] [--no-shots] [--anonymous]
 *   --anonymous : visit *every* route signed out. The signed-out routes are in the default
 *                 sweep already and choose their own session; this forces the rest too.
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const ROUTES = (args.routes ? String(args.routes).split(',') : [
  '/', '/activite', '/crypto', '/crypto/btc', '/crypto/btc/acheter', '/crypto/btc/vendre', '/crypto/btc/envoyer', '/crypto/btc/recevoir', '/crypto/recurrents',
  '/carte', '/carte/details', '/envoyer', '/envoyer/operateurs', '/convertir', '/epargne', '/epargne/deposer', '/epargne/retirer', '/epargne/objectifs/nouveau', '/epargne/objectifs/goal_01',
  '/fonds', '/profil', '/profil/securite', '/profil/notifications', '/profil/documents', '/profil/fiscalite', '/profil/aide', '/profil/donnees', '/profil/risque', '/notifications', '/entreprise', '/composants',
])

/**
 * Routes that must be visited *without* a session, and which the sweep used to skip.
 *
 * `--anonymous` decided it for a whole run, so covering them meant a second invocation
 * nobody made: the welcome screen and every step of the onboarding wizard — the first
 * screens anybody ever sees, and the only ones a new user judges the app by — had never
 * been through the contrast audit at four widths in two themes. The session is chosen per
 * route now, so one run covers both.
 */
/* The wizard's steps are **read out of the app**, not typed here. Typed, two of them were
   wrong — `identite` and `2fa`, which are not routes — and a wrong slug does not fail: the
   wizard's catch-all redirects it to step one, so step one got audited twice more under
   names that do not exist while two real steps went unvisited. A route list that can be
   wrong without saying so is worse than a shorter one that cannot. */
const STEP_SLUGS = (() => {
  const src = readFileSync(new URL('../src/features/onboarding/steps.ts', import.meta.url), 'utf8')
  const m = src.match(/export const STEPS = \[([^\]]+)\]/)
  if (!m) throw new Error('could not read the wizard steps out of src/features/onboarding/steps.ts')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => `/inscription/${x[1]}`)
})()
const ANON_ROUTES = new Set(['/bienvenue', ...STEP_SLUGS])
if (!args.routes) for (const r of ANON_ROUTES) ROUTES.push(r)
const WIDTHS = (args.widths ? String(args.widths).split(',').map(Number) : [320, 390, 768, 1440])
const THEMES = (args.themes ? String(args.themes).split(',') : ['light', 'dark'])
const SHOTS = !args['no-shots']
const ANON = !!args.anonymous
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium-') && dir !== 'chromium') continue
    for (const candidate of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome']) {
      const p = join(root, dir, candidate)
      if (existsSync(p) && statSync(p).isFile()) return p
    }
  }
  return undefined
}

const DEMO_SESSION = {
  user: { id: 'usr_01', firstName: 'Aïssatou', lastName: 'Ndiaye', email: 'aissatou.ndiaye@exemple.sn', verified: true, twoFactorEnabled: true, biometricsEnabled: false, pinSet: true, locale: 'fr-SN', createdAt: new Date(Date.now() - 100 * 86400000).toISOString() },
  token: 'e2e',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

/** Runs in the page: returns audit violations for the current DOM. */
function auditScript() {
  const out = []
  const vw = window.innerWidth
  const doc = document.scrollingElement || document.documentElement
  if (doc.scrollWidth > vw + 1) out.push({ kind: 'overflow-x', detail: `scrollWidth ${doc.scrollWidth} > viewport ${vw}` })

  // oklch/rgb → relative luminance
  function parseColor(str) {
    if (!str) return null
    let m = str.match(/^oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\)$/)
    if (m) {
      let L = parseFloat(m[1]); if (str.includes('%')) L = L / 100
      const C = parseFloat(m[2]), h = parseFloat(m[3])
      let a = m[4] !== undefined ? parseFloat(m[4]) : 1; if (m[4] && m[4].endsWith('%')) a = a / 100
      const aa = C * Math.cos(h * Math.PI / 180), bb = C * Math.sin(h * Math.PI / 180)
      const l_ = L + 0.3963377774 * aa + 0.2158037573 * bb, m_ = L - 0.1055613458 * aa - 0.0638541728 * bb, s_ = L - 0.0894841775 * aa - 1.2914855480 * bb
      const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3
      const r = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s
      const g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s
      const b = -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s
      return { r: clamp(r), g: clamp(g), b: clamp(b), a }
    }
    m = str.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
    if (m) {
      const lin = (c) => { c = c / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      return { r: lin(+m[1]), g: lin(+m[2]), b: lin(+m[3]), a: m[4] !== undefined ? parseFloat(m[4]) : 1 }
    }
    m = str.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/)
    if (m) {
      const lin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      return { r: lin(+m[1]), g: lin(+m[2]), b: lin(+m[3]), a: m[4] !== undefined ? parseFloat(m[4]) : 1 }
    }
    return null
  }
  function clamp(x) { return Math.max(0, Math.min(1, x)) }
  function lum(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b }
  function blend(fg, bg) { return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 } }
  function effectiveBg(el) {
    let node = el
    let acc = null
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      const c = parseColor(cs.backgroundColor)
      if (c && c.a > 0) {
        if (!acc) acc = c
        else acc = blend(acc, c)
        if (acc.a >= 1 || c.a >= 1) return acc
      }
      node = node.parentElement
    }
    const rootBg = parseColor(getComputedStyle(document.documentElement).backgroundColor) || parseColor(getComputedStyle(document.body).backgroundColor) || { r: 1, g: 1, b: 1, a: 1 }
    return acc ? blend(acc, rootBg) : rootBg
  }
  function visible(el) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    if (el.closest('.sr-only, [aria-hidden="true"]')) return false
    return true
  }
  /* Nothing *sticky* may sit under the floating nav.
   *
   * The pill is fixed and detached from the bottom edge, so a screen with something of its
   * own down there — a sticky « Continuer », a sticky search bar — has to clear it by hand:
   * `calc(var(--navbar-height) + var(--navbar-gap) * 2 + var(--safe-bottom) + …)`, which is
   * a rule in CLAUDE.md that nothing checked. Get it wrong and the pill covers the button
   * the screen exists to offer, and it covers it *silently*: the button is present,
   * focusable and reachable by keyboard, so the keyboard walk passes and a screenshot shows
   * a page that looks fine apart from one control being half a pill short.
   *
   * **Only sticky and fixed elements count.** An ordinary control that happens to be at
   * that height right now is not covered by anything — the page scrolls and it moves. The
   * first version of this check ignored that and reported 54 « violations », almost all of
   * them accordion rows on /profil/aide that scroll out from under the pill the moment
   * anybody touches the screen. A check that cries wolf on a scrollable page is worse than
   * no check, because the two real ones were in the middle of it.
   *
   * The test is the element's own centre, not its box: a sticky bar whose top edge slides
   * under the pill's bottom by a pixel is fine, and one whose middle is under it is not. */
  const nav = Array.from(document.querySelectorAll('nav')).find((n) => {
    const r = n.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(n).position === 'fixed'
  })
  if (nav) {
    const nb = nav.getBoundingClientRect()
    const pinned = (el) => {
      for (let n = el; n instanceof Element; n = n.parentElement) {
        if (n === nav) return null
        const pos = getComputedStyle(n).position
        if (pos === 'sticky' || pos === 'fixed') return n
      }
      return null
    }
    const covered = new Set()
    for (const el of document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="tab"],[role="switch"]')) {
      if (nav.contains(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      if (cx <= nb.x || cx >= nb.right || cy <= nb.y || cy >= nb.bottom) continue
      if (!pinned(el)) continue
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32)
      if (covered.has(name)) continue
      covered.add(name)
      out.push({ kind: 'under-nav', detail: `sticky "${name}" sits under the floating nav (nav ${Math.round(nb.y)}–${Math.round(nb.bottom)}, control centre ${Math.round(cy)}) — it cannot be scrolled out` })
    }
  }

  const seen = new Set()
  const all = Array.from(document.body.querySelectorAll('*'))
  for (const el of all) {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT'].includes(el.tagName)) continue
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    const tag = el.tagName.toLowerCase()
    const key = (s) => `${tag}.${(el.className && typeof el.className === 'string') ? el.className.split(' ')[0] : ''}:${s}`
    if (hasText) {
      const fs = parseFloat(cs.fontSize)
      if (fs < 12 && !seen.has(key('fs'))) { seen.add(key('fs')); out.push({ kind: 'font-size', detail: `${fs}px "${el.textContent.trim().slice(0, 30)}"` }) }
      const fg = parseColor(cs.color)
      const bg = effectiveBg(el)
      if (fg && bg) {
        const f = fg.a < 1 ? blend(fg, bg) : fg
        const l1 = lum(f), l2 = lum(bg)
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700)
        const min = large ? 3 : 4.5
        if (ratio < min && !seen.has(key('contrast'))) { seen.add(key('contrast')); out.push({ kind: 'contrast', detail: `${ratio.toFixed(2)}:1 (${fs}px) "${el.textContent.trim().slice(0, 30)}" color=${cs.color} bg=${JSON.stringify(bg)}` }) }
      }
    }
    if ((tag === 'button' || tag === 'a' || el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'switch' || tag === 'input' || tag === 'select') && !el.closest('nav') ) {
      const r = el.getBoundingClientRect()
      const inline = cs.display === 'inline' && tag === 'a'
      if (!inline && (r.height < 43.5 || r.width < 43.5) && !seen.has(key('tap'))) { seen.add(key('tap')); out.push({ kind: 'tap-target', detail: `${tag} ${Math.round(r.width)}×${Math.round(r.height)} "${el.textContent.trim().slice(0, 24) || el.getAttribute('aria-label') || ''}"` }) }
    }
  }
  return out
}

const exe = findChromium()
const browser = await chromium.launch({ executablePath: exe, headless: true })
const summary = []
let total = 0
try {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ colorScheme: theme, locale: 'fr-SN', deviceScaleFactor: 1 })
    /* Both, and the page picks. An init script runs before every navigation, so it cannot
       be the thing that decides — it reads a flag the loop sets just before each goto. */
    await ctx.addInitScript((session) => {
      try {
        if (sessionStorage.getItem('e2e.anon') === '1') {
          localStorage.removeItem('keewal.session')
          localStorage.removeItem('keewal.onboarding')
        } else {
          localStorage.setItem('keewal.session', JSON.stringify(session))
          localStorage.setItem('keewal.pin', '"1234"')
        }
      } catch {}
    }, DEMO_SESSION)
    for (const width of WIDTHS) {
      const page = await ctx.newPage()
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
      /* One throwaway navigation to put the page on the app's origin before the loop.
         `sessionStorage` is per-origin and a fresh page sits on `about:blank`, so the flag
         written for the first route landed nowhere: /bienvenue was visited *with* a session,
         redirected to the dashboard, and audited the home screen under the welcome screen's
         name — passing, and measuring the wrong page. */
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
      for (const route of ROUTES) {
        const url = BASE + route
        try {
          const anon = ANON || ANON_ROUTES.has(route)
          /* `sessionStorage` survives the navigation the init script runs before, which
             `localStorage` written here would not — the script clears that one. */
          await page.evaluate((v) => sessionStorage.setItem('e2e.anon', v), anon ? '1' : '0').catch(() => {})
          await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
          await page.waitForTimeout(700)
          // Let skeletons resolve (mock latency ≤ 600 ms + settle)
          await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(300)
          const violations = await page.evaluate(auditScript)
          const name = (route === '/' ? 'home' : route.replace(/^\//, '').replace(/[\/:]/g, '_')) + `-${width}-${theme}`
          if (SHOTS) await page.screenshot({ path: join(OUT, name + '.png'), fullPage: true })
          total += violations.length
          if (violations.length || errors.length) summary.push({ route, width, theme, violations, errors: errors.splice(0) })
        } catch (e) {
          summary.push({ route, width, theme, violations: [{ kind: 'navigation', detail: String(e).slice(0, 200) }], errors: [] })
          total += 1
        }
      }
      await page.close()
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

if (summary.length) {
  for (const s of summary) {
    console.log(`\n${s.route} @${s.width} ${s.theme}`)
    for (const v of s.violations) console.log(`  - [${v.kind}] ${v.detail}`)
    for (const e of s.errors) console.log(`  - [console] ${e.slice(0, 200)}`)
  }
  console.log(`\n${total} violation(s) across ${summary.length} page/viewport combos. Screenshots in e2e/out/`)
  process.exit(1)
} else {
  console.log(`Audit clean: ${ROUTES.length} routes × ${WIDTHS.length} widths × ${THEMES.length} themes. Screenshots in e2e/out/`)
}
