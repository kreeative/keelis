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
  '/fonds', '/profil', '/profil/informations', '/profil/securite', '/profil/notifications', '/profil/documents', '/profil/fiscalite', '/profil/aide', '/profil/donnees', '/profil/risque', '/notifications', '/entreprise', '/composants',
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
  /**
   * The stops of a gradient `background-image`, as linear-light colours, or null.
   *
   * **A gradient-filled element reports `background-color: rgba(0, 0, 0, 0)`**, so the walk
   * below stepped straight past it to whatever was behind — and the moment `--grad-cta`
   * landed, this audit measured the app's primary button against the *canvas* and called
   * «　Envoyer　» 1.03:1. The button was fine; the instrument had gone blind to exactly the
   * control it most needs to see, and it did so while still reporting a number, which is the
   * worst way for a check to fail.
   *
   * Every stop is converted through a canvas rather than parsed, because Chromium reports a
   * computed colour in the space it was authored in and every token here is `oklch()` —
   * `getImageData` is always sRGB bytes. (That is the third time that trap has been paid
   * for in this repo: once in the painted-over audit, once in a focus-ring measurement.)
   */
  const swatch = document.createElement('canvas')
  swatch.width = swatch.height = 1
  const swatchCx = swatch.getContext('2d', { willReadFrequently: true })
  function gradientStops(cssImage) {
    if (!cssImage || cssImage === 'none' || !/gradient\(/.test(cssImage)) return null
    /* Colour functions only — `180deg`, `0%` and the gradient's own name are not colours. */
    const found = cssImage.match(/(?:oklch|oklab|lab|lch|color|rgba?|hsla?)\([^()]*\)/g)
    if (!found || !found.length) return null
    const out = []
    for (const c of found) {
      try {
        swatchCx.clearRect(0, 0, 1, 1)
        swatchCx.fillStyle = '#000'
        swatchCx.fillStyle = c
        swatchCx.fillRect(0, 0, 1, 1)
        const d = swatchCx.getImageData(0, 0, 1, 1).data
        const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        out.push({ r: lin(d[0]), g: lin(d[1]), b: lin(d[2]), a: d[3] / 255 })
      } catch {}
    }
    return out.length ? out : null
  }
  /**
   * A gradient's stops **with their positions**, for the scrim maths below.
   *
   * Chromium prints the percentages it computed, so `linear-gradient(180deg, C 0%, C 46%…)`
   * comes back parseable. A stop with no position is spread evenly, which is the same rule
   * CSS itself uses.
   */
  function gradientRamp(cssImage) {
    if (!cssImage || cssImage === 'none' || !/gradient\(/.test(cssImage)) return null
    const re = /((?:oklch|oklab|lab|lch|color|rgba?|hsla?)\([^()]*\))(?:\s+([\d.]+)%)?/g
    const raw = []
    let m
    while ((m = re.exec(cssImage))) raw.push({ color: m[1], pos: m[2] === undefined ? null : Number(m[2]) / 100 })
    if (raw.length < 2) return null
    raw.forEach((st, i) => { if (st.pos === null) st.pos = i / (raw.length - 1) })
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return raw.map((st) => {
      swatchCx.clearRect(0, 0, 1, 1)
      swatchCx.fillStyle = '#000'
      swatchCx.fillStyle = st.color
      swatchCx.fillRect(0, 0, 1, 1)
      const d = swatchCx.getImageData(0, 0, 1, 1).data
      return { pos: st.pos, r: lin(d[0]), g: lin(d[1]), b: lin(d[2]), a: d[3] / 255 }
    })
  }

  /**
   * The worst background a piece of text over a photograph can have.
   *
   * **No check in this repo can measure text on a picture** — every one of them reads
   * computed styles, and a photograph has no colour to read. That is the same shape as the
   * gradient hole above, one level worse: there, the colour existed and the walk stepped past
   * it; here there is genuinely nothing to read, so an audit that reports a number is
   * inventing one.
   *
   * It is still decidable, though, and this is how. The type sits under `Photo`'s scrim, whose
   * alpha at the text's own height is computable; composite that scrim over **white** and you
   * have the brightest frame that could ever be dropped into the slot. Text that clears the
   * threshold against *that* clears it against any photograph the owner licenses — which is a
   * real guarantee rather than a hope, and it can be checked before the photographs exist.
   *
   * **The dissolve is the same computation from the other end.** A frame that is a screen's
   * underlay carries the page colour poured down over its top (`::before`), and the type sits
   * on that; here the worst picture is not white but *whichever* of black and white the ink
   * loses against — cream over black under dark ink in the light theme, brown over white
   * under pale ink in the dark one. Both are composited, in paint order (picture, scrim,
   * dissolve), and the one with the worse ratio against `fg` is the floor. Text that clears
   * that clears any photograph; text sitting where the dissolve has let go gets a number
   * against a picture nobody has chosen, which is the audit refusing to guess.
   */
  function scrimFloor(el, frame, fg) {
    const scrim = gradientRamp(getComputedStyle(frame, '::after').backgroundImage)
    const dissolve = gradientRamp(getComputedStyle(frame, '::before').backgroundImage)
    if (!scrim && !dissolve) return null
    const fr = frame.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    if (fr.height <= 0) return null
    const t = Math.max(0, Math.min(1, (er.top + er.height / 2 - fr.top) / fr.height))
    const at = (ramp) => {
      let lo = ramp[0]
      let hi = ramp[ramp.length - 1]
      for (let i = 0; i < ramp.length - 1; i++) {
        if (t >= ramp[i].pos && t <= ramp[i + 1].pos) { lo = ramp[i]; hi = ramp[i + 1]; break }
      }
      const span = hi.pos - lo.pos
      const k = span > 0 ? (t - lo.pos) / span : 0
      const mix = (a, b) => a + (b - a) * k
      return { r: mix(lo.r, hi.r), g: mix(lo.g, hi.g), b: mix(lo.b, hi.b), a: mix(lo.a, hi.a) }
    }
    const layers = [scrim && at(scrim), dissolve && at(dissolve)].filter(Boolean)
    const over = (picture) => layers.reduce((acc, layer) => blend(layer, acc), picture)
    const white = over({ r: 1, g: 1, b: 1, a: 1 })
    if (!fg) return white
    const black = over({ r: 0, g: 0, b: 0, a: 1 })
    const lf = lum(fg)
    const ratio = (c) => { const l = lum(c); return (Math.max(lf, l) + 0.05) / (Math.min(lf, l) + 0.05) }
    return ratio(black) < ratio(white) ? black : white
  }

  /**
   * The background a piece of text actually sits on.
   *
   * With `fg` given and a gradient underneath, it returns the **worst** stop rather than an
   * average: a value-fall means the label at the bottom of a button is on a different colour
   * from the label at the top, and a ratio computed on the mean is a ratio true of neither
   * end. An audit reports the floor.
   */
  function effectiveBg(el, fg) {
    let node = el
    let acc = null
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      /* A photo frame: stop here. Whatever is behind it is irrelevant, because a picture is
         painted over it, and the scrim is the only thing between this text and that picture. */
      if (node.hasAttribute && node.hasAttribute('data-photo')) {
        const floor = scrimFloor(el, node, fg)
        if (floor) return acc ? blend(acc, floor) : floor
        return { unmeasurable: true }
      }
      const stops = gradientStops(cs.backgroundImage)
      if (stops) {
        const opaque = stops.filter((c) => c.a >= 1)
        if (opaque.length) {
          let worst = opaque[0]
          if (fg) {
            const lf = lum(fg)
            const r = (c) => { const l = lum(c); return (Math.max(lf, l) + 0.05) / (Math.min(lf, l) + 0.05) }
            for (const c of opaque) if (r(c) < r(worst)) worst = c
          }
          return acc ? blend(acc, worst) : worst
        }
      }
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
      /**
       * **A photograph under this text that is not an ancestor of it.**
       *
       * `effectiveBg` walks the DOM, which finds a frame the text sits *inside*. It cannot
       * see one the text merely sits *over* — a hero positioned behind a type block by
       * z-index is a sibling, so the walk goes straight past it to the page colour and
       * reports a clean ratio against a background the reader never sees.
       *
       * That is not hypothetical: overlapping the welcome title onto the hero, to match the
       * reference, put the whole lede on a dark corridor and this audit said « clean ». The
       * text was illegible in the screenshot and perfect in the numbers.
       *
       * Geometry answers it where ancestry cannot: ask what is actually stacked under the
       * middle of the line.
       *
       * The walk stops at the first ancestor that paints an opaque fill, because a photograph
       * under an opaque sheet is a photograph nobody sees: the welcome frame is the whole
       * screen's underlay now, and without this every line on the sheet riding over it was
       * « on a photograph ». And a frame it does reach is measured through its scrim and its
       * dissolve rather than declared unmeasurable — the type on the welcome screen sits on
       * the frame's dissolved top third by design, and that is exactly the case the floor
       * computation exists for.
       */
      const overPhoto = (() => {
        const r = el.getBoundingClientRect()
        const x = Math.round(r.left + r.width / 2)
        const y = Math.round(r.top + r.height / 2)
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null
        for (const node of document.elementsFromPoint(x, y)) {
          if (node === el) continue
          if (node.contains && node.contains(el)) {
            const ncs = getComputedStyle(node)
            const solid = parseColor(ncs.backgroundColor)
            const stops = gradientStops(ncs.backgroundImage)
            if ((solid && solid.a >= 1) || (stops && stops.some((c) => c.a >= 1))) return null
            continue // a see-through ancestor: effectiveBg has it
          }
          if (node.hasAttribute && node.hasAttribute('data-photo')) return node
        }
        return null
      })()
      const bg = overPhoto ? (scrimFloor(el, overPhoto, fg) ?? { unmeasurable: true }) : effectiveBg(el, fg)
      if (bg && bg.unmeasurable) {
        /* Text on a photograph with no scrim. Reporting a ratio here would be reporting a
           number about a colour nothing knows — the failure this whole helper exists to
           avoid — so it says so instead. Give the frame a `scrim` and it becomes measurable. */
        if (!seen.has(key('contrast'))) { seen.add(key('contrast')); out.push({ kind: 'contrast-unmeasurable', detail: `"${el.textContent.trim().slice(0, 30)}" sits on a photograph with no scrim — nothing can measure it` }) }
      } else if (fg && bg) {
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

/**
 * Nothing sits under the notch.
 *
 * `env(safe-area-inset-top)` is 0 in headless Chromium, and 47–59px on the phones this app
 * is for — so every page but Accueil started its content 24px from the top with no
 * allowance, and the virtual card, the page titles and the AppBar all sat under the clock
 * and the battery. Not one check here could see it. It took a photograph of a real phone.
 *
 * So the inset is *simulated*: the token is overridden to a real iPhone's value and the
 * page is asked what is now in the band. Anything a person reads or touches must be below
 * it. A background may bleed up through — Accueil's dark canvas is supposed to run behind
 * the status bar — so this looks only at text and controls.
 */
const NOTCH = 47

async function notchViolations(page) {
  const tag = await page.addStyleTag({
    content: `:root { --safe-top: ${NOTCH}px !important; --safe-bottom: 34px !important; }`,
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  const found = await page.evaluate((inset) => {
    const out = []
    const seen = new Set()
    for (const el of document.querySelectorAll('a,button,input,select,textarea,h1,h2,h3,p,span,li,[role="button"]')) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
      const control = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute('role') === 'button'
      if (!text && !control) continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      /* Entirely above the viewport is off-screen, not covered: the skip link parks itself
         at `top: -100px` until it is focused, which is the whole point of it. */
      if (r.bottom <= 0) continue
      // Its *middle* under the inset: a box whose top edge grazes it is not covered.
      if (r.top + r.height / 2 >= inset) continue
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32)
      if (seen.has(name)) continue
      seen.add(name)
      out.push({ kind: 'under-notch', detail: `"${name}" sits under the status bar (its middle is ${Math.round(r.top + r.height / 2)}px, the inset is ${inset}px)` })
    }
    return out
  }, NOTCH)
  await tag.evaluate((node) => node.remove())
  return found
}

/**
 * Anything present, focusable and **painted over** — a control or a heading that is in the
 * DOM, visible by every CSS measure, and contributes not one pixel to the screen.
 *
 * This is the one failure mode none of the other checks here can see, because what it looks
 * like is *nothing*. Accueil carried a desktop-only header above its canvas with the
 * greeting and two buttons in it; `.canvas::before` carries the canvas colour 100vh up past
 * its own top edge so an iOS overscroll shows more canvas instead of a seam, and being
 * positioned it painted straight over its static sibling. The contrast audit had nothing to
 * measure. The tap-target audit measured a 44px button that was there. The keyboard walk
 * stopped on both buttons and found them visible, ringed and reversible — they were. The
 * screenshot showed an empty band, which is what an empty band looks like.
 *
 * It is found by hit-testing rather than by pixels, which makes it cheap: `pointer-events`
 * is forced on for every element *and every pseudo-element*, so `elementFromPoint` returns
 * whatever is really on top — a `::before` reports its owner — and five points across each
 * target are asked. A target is only flagged if every point lands on something that is
 * neither it nor a relation of it, and that something paints an opaque fill.
 *
 * **Overlays are excluded, and that is what keeps it quiet.** A `fixed` or `sticky`
 * ancestor means the thing on top is meant to be on top and moves independently — the
 * floating nav pill sits over the foot of every page, and the control under it scrolls out
 * the moment anybody touches the screen. That is the under-nav check's business, and it
 * counts only sticky elements for exactly the same reason.
 *
 * Alpha is parsed rather than matched against `rgba(…)`: Chromium reports a computed
 * `background-color` in the colour space it was authored in, so every token in this app
 * comes back as `oklch(…)` and an `rgba`-shaped regex reads every surface as transparent.
 * The first version of this check did exactly that and found nothing at all.
 */
async function paintedOverViolations(page) {
  return page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { pointer-events: auto !important; }'
    document.head.appendChild(style)
    const alpha = (c) => {
      if (!c || c === 'transparent' || c === 'none') return 0
      const m = /\(([^)]*)\)/.exec(c)
      if (!m) return 1
      const inner = m[1]
      if (inner.includes('/')) return parseFloat(inner.split('/')[1]) || 0
      const parts = inner.split(',')
      return parts.length > 3 ? parseFloat(parts[3]) || 0 : 1
    }
    const opaque = (el) => [null, '::before', '::after'].some((pseudo) => {
      const s = getComputedStyle(el, pseudo)
      return alpha(s.backgroundColor) >= 0.9 || (s.backgroundImage && s.backgroundImage !== 'none')
    })
    const overlay = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const pos = getComputedStyle(n).position
        if (pos === 'fixed' || pos === 'sticky') return true
      }
      return false
    }
    const out = []
    const seen = new Set()
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), h1, h2')) {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
      let covered = null
      let asked = 0
      for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
        const x = r.left + r.width * fx
        const y = r.top + r.height * fy
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
        asked++
        const top = document.elementFromPoint(x, y)
        if (!top) continue
        // One point showing through is enough: the element is on screen.
        if (top === el || el.contains(top) || top.contains(el)) { covered = null; break }
        if (opaque(top) && !overlay(top)) covered = top
      }
      if (!asked || !covered) continue
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32)
      if (seen.has(name)) continue
      seen.add(name)
      const by = covered.tagName.toLowerCase() + (covered.className ? '.' + String(covered.className).split(/\s+/).pop() : '')
      out.push({ kind: 'painted-over', detail: `"${name}" is in the DOM and focusable but paints nothing — ${by} covers it` })
    }
    style.remove()
    return out
  })
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
    await ctx.addInitScript(
      ({ session, theme }) => {
        try {
          if (sessionStorage.getItem('e2e.anon') === '1') {
            localStorage.removeItem('keewal.session')
            localStorage.removeItem('keewal.onboarding')
          } else {
            localStorage.setItem('keewal.session', JSON.stringify(session))
            localStorage.setItem('keewal.pin', '"1234"')
          }
          /* **`colorScheme` alone stopped choosing the theme, and this audit did not notice.**
             The app defaults to light rather than to the system's preference, and « système »
             is now a *choice* somebody makes rather than the absence of one — so a context
             opened with `colorScheme: 'dark'` renders `data-theme="light"`, with every token
             identical to the light pass. Measured on /bienvenue: `--surface` came back
             `oklch(.985 .008 90)` under both schemes. Every dark run of this sweep — 42 routes
             at four widths — was auditing the light theme a second time, so the dark theme has
             had no contrast, overflow or notch check at all since that default changed, and
             the screenshots in e2e/out named `-dark` were light.
             The choice is a **bare string, not JSON**: three harnesses wrote `'"light"'`, which
             matched nothing and fell back silently. `colorScheme` stays because `index.html`'s
             two `theme-color` metas are still gated on the media query. */
          localStorage.setItem('keewal.theme', theme)
        } catch {}
      },
      { session: DEMO_SESSION, theme },
    )
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
          /* A notch is a phone thing; a 1440px window has no status bar over the page. */
          if (width < 768) violations.push(...(await notchViolations(page)))
          violations.push(...(await paintedOverViolations(page)))
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
