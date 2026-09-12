#!/usr/bin/env node
/**
 * Visual + runtime audit. Builds nothing itself: expects the app served at BASE_URL
 * (default http://localhost:4173, i.e. `pnpm build && pnpm preview`).
 *
 * For each route × viewport × theme it:
 *  - screenshots to e2e/out/<route>-<width>-<theme>.png
 *  - audits: horizontal overflow, text < 12px, tap targets < 44px, and WCAG contrast
 *    (< 4.5:1 for text, < 3:1 for ≥24px text), computed against the real composited
 *    background — translucent glass surfaces are blended down to the ground colour
 *
 * Usage: node e2e/screenshots.mjs [--routes=/,/crypto] [--widths=390,1440] [--themes=light,dark] [--no-shots] [--anonymous]
 *   --anonymous : do not inject the demo session (for /bienvenue and /inscription/* routes)
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const ROUTES = (args.routes ? String(args.routes).split(',') : [
  '/', '/activite', '/crypto', '/crypto/btc', '/crypto/btc/acheter', '/crypto/btc/vendre', '/crypto/btc/envoyer', '/crypto/btc/recevoir', '/crypto/recurrents',
  '/carte', '/carte/details', '/envoyer', '/envoyer/operateurs', '/convertir', '/epargne', '/epargne/deposer', '/epargne/retirer', '/epargne/objectifs/nouveau', '/epargne/objectifs/goal_01',
  '/fonds', '/profil', '/profil/securite', '/profil/notifications', '/profil/documents', '/profil/fiscalite', '/profil/aide', '/notifications', '/composants',
])
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
  user: { id: 'usr_01', firstName: 'Aïssatou', lastName: 'Ndiaye', email: 'aissatou.ndiaye@exemple.ca', verified: true, twoFactorEnabled: true, biometricsEnabled: false, pinSet: true, locale: 'fr-SN', createdAt: new Date(Date.now() - 100 * 86400000).toISOString() },
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
    await ctx.addInitScript((session) => {
      try {
        if (session) {
          localStorage.setItem('keelis.session', JSON.stringify(session))
          localStorage.setItem('keelis.pin', '"1234"')
        } else {
          localStorage.removeItem('keelis.session')
          localStorage.removeItem('keelis.onboarding')
        }
      } catch {}
    }, ANON ? null : DEMO_SESSION)
    for (const width of WIDTHS) {
      const page = await ctx.newPage()
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
      for (const route of ROUTES) {
        const url = BASE + route
        try {
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
