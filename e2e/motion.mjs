/**
 * The app's motion, measured rather than watched.
 *
 * A screenshot cannot see motion at all, and the flow walker clicks through it too fast to
 * care. So everything in `CLAUDE.md`'s motion section was a claim nothing checked: that the
 * curves are springs, that a sheet comes in and — the part that did not exist until now —
 * goes back out, that the page behind it recedes, and that `prefers-reduced-motion` gets
 * the end state instead of a faster animation.
 *
 * The one that genuinely needed measuring is the recession. Scaling the page behind a sheet
 * makes that element the containing block for every `position: fixed` descendant, and the
 * floating nav is one of them — so on a long page the nav silently leaves the screen for
 * the bottom of the document every time a sheet opens. That is invisible in the CSS, obvious
 * on screen, and exactly one number here.
 *
 * Usage: node e2e/motion.mjs   (against `pnpm preview`, default http://localhost:4173)
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium')) continue
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

const failures = []
const notes = []
const fail = (where, detail) => failures.push(`${where}: ${detail}`)

/** A sheet somewhere every build has one: the filter on the transaction list. */
const SHEET_ROUTE = '/carte'

/**
 * `networkidle` is not « the page is up ». Every screen is its own lazy chunk, and the
 * network can go quiet between the document arriving and the chunk being fetched — which
 * leaves the Suspense fallback on screen, with no nav and no content to scroll. Measuring
 * that and reporting « no <nav> on the page » is how this audit failed on one run in two
 * while the app was perfectly fine. Wait for the thing being measured.
 */
async function ready(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  /* `nav:visible`, not `nav`: there are two — the phone's floating pill and the desktop
     rail — and exactly one of them is displayed at any width. Waiting on the first in tree
     order hangs at 1440px, where that one is the hidden mobile pill. */
  await page.waitForSelector('nav:visible', { timeout: 15_000 })
  await page.waitForFunction(() => document.body.innerText.trim().length > 200, null, { timeout: 15_000 })
  /* And not while it is still mounting. Text on screen is not a settled page: /carte shows
     its skeletons long before its filter button has a handler, and clicking one then is a
     coin toss — measured, the desktop sheet check failed one run in two on a machine doing
     nothing else, which is a flaky check and therefore a useless one. This is the same wait
     `e2e/screenshots.mjs` takes, for the same reason. */
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function newPage(context, { reducedMotion = 'no-preference' } = {}) {
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion })
  await page.addInitScript((s) => {
    localStorage.setItem('keewal.session', s)
    localStorage.setItem('keewal.theme', 'light')
  }, JSON.stringify(DEMO_SESSION))
  return page
}

/**
 * Click whatever on this page opens a sheet, and say which.
 *
 * **It waits for the dialog rather than asking in the same breath.** It used to click and
 * read `count()` on the next line, which is a race it loses whenever the machine is busy:
 * a `Sheet` mounts on a state change and paints on the next frame, so a loaded runner
 * reports « found nothing that opens a dialog » on a page where the button is right there.
 * That failure is indistinguishable from a real one, which makes it worse than no check —
 * this run said exactly that about /carte at 1440px while three browsers were fighting over
 * the same preview server. A second is far longer than the sheet needs and still fails fast
 * when nothing opens.
 */
async function openASheet(page) {
  const buttons = await page.locator('button:visible').all()
  for (const b of buttons) {
    const label = ((await b.getAttribute('aria-label')) ?? (await b.textContent()) ?? '').trim()
    if (!/filtr|trier|détail|options/i.test(label)) continue
    /* Bring it into view *first*, then read where the page ended up, and only then click.
       Playwright scrolls an element into view before clicking it, so the click itself can
       move the page — and the scroll check below was comparing against a baseline read
       before that happened. On /carte at 780px the filter button's bottom edge sits nine
       pixels below the fold, so opening the sheet scrolled to 409 while the check still
       believed 400, and reported « closing the sheet moved the page » about a sheet that
       had handed back exactly what it took. The question is whether you get back the scroll
       you were at **when the sheet opened**, so that is the number to hold. */
    await b.scrollIntoViewIfNeeded().catch(() => {})
    const scrollAtOpen = await page.evaluate(() => Math.round(window.scrollY))
    await b.click().catch(() => {})
    const opened = await page
      .locator('[role="dialog"]')
      .first()
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false)
    if (opened) return { label, scrollAtOpen }
  }
  return null
}

async function run() {
  const browser = await chromium.launch({ executablePath: findChromium() })
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } })

  // ---- 1. The curves are springs, and the tokens resolve ----
  {
    const page = await newPage(context)
    await ready(page, '/')
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      const read = (n) => cs.getPropertyValue(n).trim()
      return {
        smooth: read('--ease-smooth'), snappy: read('--ease-snappy'), bouncy: read('--ease-bouncy'),
        exit: read('--ease-exit'),
        durs: ['--dur-smooth', '--dur-snappy', '--dur-bouncy', '--dur-exit', '--dur-press'].map((n) => [n, read(n)]),
      }
    })
    for (const [name, v] of [['smooth', tokens.smooth], ['snappy', tokens.snappy], ['bouncy', tokens.bouncy]]) {
      if (!v.startsWith('linear(')) fail('tokens', `--ease-${name} is not a linear() curve: ${v || '(empty)'}`)
    }
    if (!tokens.exit.startsWith('cubic-bezier')) fail('tokens', `--ease-exit should stay a bezier, got ${tokens.exit || '(empty)'}`)
    /* A spring that never goes past 1 is a bezier wearing a costume. Snappy and bouncy are
       the two that are supposed to overshoot, and this is the only place that can tell. */
    for (const [name, v] of [['snappy', tokens.snappy], ['bouncy', tokens.bouncy]]) {
      const peak = Math.max(...(v.match(/[\d.]+/g) ?? ['0']).map(Number))
      if (peak <= 1) fail('tokens', `--ease-${name} never overshoots (peak ${peak}) — it is not a spring`)
      else notes.push(`--ease-${name} peaks at ${peak} (${((peak - 1) * 100).toFixed(1)}% overshoot)`)
    }
    /* A computed duration comes back normalised — `300ms` reads as `.3s` — so parse it
       rather than matching the unit it was written in. */
    const seconds = (v) => (v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v))
    for (const [n, v] of tokens.durs) {
      const s = seconds(v)
      if (!Number.isFinite(s) || s <= 0) fail('tokens', `${n} is ${v || '(empty)'}`)
    }
    /* The old single bezier is gone, and nothing may quietly keep using it. */
    const legacy = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      return ['--ease', '--dur', '--dur-fast', '--dur-slow'].filter((n) => cs.getPropertyValue(n).trim())
    })
    if (legacy.length) fail('tokens', `retired motion tokens are still defined: ${legacy.join(', ')}`)
    await page.close()
  }

  // ---- 2. The sheet presentation ----
  {
    const page = await newPage(context)
    await ready(page, SHEET_ROUTE)
    // Scroll down, because that is the case the freeze exists for.
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.waitForTimeout(120)
    const scrollBefore = await page.evaluate(() => window.scrollY)
    if (scrollBefore < 100) fail('sheet', `${SHEET_ROUTE} did not scroll (${scrollBefore}px) — the freeze is untested without it`)

    const navBefore = await page.evaluate(() => {
      const nav = document.querySelector('nav')
      return nav ? Math.round(nav.getBoundingClientRect().bottom) : null
    })
    if (navBefore === null) fail('sheet', 'no <nav> on the page to measure')

    const opener = await openASheet(page)
    if (!opener) {
      fail('sheet', `found nothing on ${SHEET_ROUTE} that opens a dialog`)
    } else {
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(60) // mid-animation on purpose

      const mid = await page.evaluate(() => {
        const nav = document.querySelector('nav')
        const view = document.querySelector('.app-view')
        const panel = document.querySelector('[role="dialog"]')
        return {
          sheetAttr: document.documentElement.dataset.sheet ?? null,
          navBottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : null,
          viewTransform: view ? getComputedStyle(view).transform : null,
          panelY: panel ? Math.round(panel.getBoundingClientRect().top) : null,
          innerHeight: window.innerHeight,
        }
      })
      if (mid.sheetAttr !== 'open') fail('sheet', `<html data-sheet> is ${mid.sheetAttr} while a dialog is up`)
      if (mid.viewTransform === 'none') fail('sheet', 'the page behind a sheet is not receding')
      /* The nav must still be on screen. This is the whole reason the view is frozen: with
         a plain transform it would be pinned to the bottom of a 1500px document. */
      if (mid.navBottom !== null && mid.navBottom > mid.innerHeight + 8) {
        fail('sheet', `the nav left the screen while a sheet was open (bottom ${mid.navBottom} of ${mid.innerHeight}) — the transform is acting as a containing block for it`)
      }

      // Settled, then dismissed with Escape.
      await page.waitForTimeout(800)
      const settled = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"]')
        return panel ? Math.round(panel.getBoundingClientRect().top) : null
      })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(70)
      const leaving = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"]')
        return {
          stillMounted: !!panel,
          top: panel ? Math.round(panel.getBoundingClientRect().top) : null,
          sheetAttr: document.documentElement.dataset.sheet ?? null,
        }
      })
      /* The sheet used to be unmounted between two frames. If it is still here 70 ms after
         Escape *and* has moved from where it settled, it is animating out. */
      if (!leaving.stillMounted) fail('sheet', 'dismissed instantly — there is no exit animation')
      else if (settled !== null && leaving.top !== null && leaving.top <= settled + 2) {
        fail('sheet', `still on screen after Escape but not moving (settled at ${settled}, now ${leaving.top})`)
      }
      if (leaving.sheetAttr !== 'closing') fail('sheet', `<html data-sheet> is ${leaving.sheetAttr} during the exit, expected "closing"`)

      await page.waitForTimeout(600)
      const after = await page.evaluate(() => ({
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        sheetAttr: document.documentElement.dataset.sheet ?? null,
        scroll: window.scrollY,
        navBottom: (() => { const n = document.querySelector('nav'); return n ? Math.round(n.getBoundingClientRect().bottom) : null })(),
        viewTransform: (() => { const v = document.querySelector('.app-view'); return v ? getComputedStyle(v).transform : null })(),
      }))
      if (after.dialogs) fail('sheet', 'the dialog is still in the tree after its exit')
      if (after.sheetAttr !== null) fail('sheet', `<html data-sheet> was left set to "${after.sheetAttr}"`)
      /* The freeze clamps the document scroll to zero. Handing it back is the part a user
         would notice: dismissing a sheet must not send the page to the top. */
      /* Against the scroll the sheet froze, not the one set before the opener was reached. */
      if (Math.abs(after.scroll - opener.scrollAtOpen) > 2) {
        fail('sheet', `closing the sheet moved the page (was ${opener.scrollAtOpen} when it opened, now ${after.scroll})`)
      }
      if (after.viewTransform !== 'none') fail('sheet', `the page did not come back (transform ${after.viewTransform})`)
      if (navBefore !== null && after.navBottom !== null && Math.abs(after.navBottom - navBefore) > 2) {
        fail('sheet', `the nav did not return to where it was (${navBefore} → ${after.navBottom})`)
      }
      notes.push(`sheet: opened from « ${opener.label} », receded the page, animated out, scroll restored to ${after.scroll}`)
    }
    await page.close()
  }

  // ---- 3. Reduced motion gets the end state, not a faster animation ----
  {
    const page = await newPage(context, { reducedMotion: 'reduce' })
    await ready(page, SHEET_ROUTE)
    const durs = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      return ['--dur-smooth', '--dur-snappy', '--dur-bouncy', '--dur-exit', '--dur-press', '--dur-figure', '--dur-draw']
        .map((n) => [n, cs.getPropertyValue(n).trim()])
        .filter(([, v]) => parseFloat(v) !== 0)
    })
    if (durs.length) fail('reduced-motion', `these durations survive: ${durs.map(([n, v]) => `${n}=${v}`).join(', ')}`)

    const opener = await openASheet(page)
    if (opener) {
      await page.waitForSelector('[role="dialog"]')
      const recede = await page.evaluate(() => {
        const v = document.querySelector('.app-view')
        return v ? getComputedStyle(v).transform : null
      })
      if (recede !== 'none') fail('reduced-motion', `the page still recedes behind a sheet (${recede})`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(40)
      const still = await page.locator('[role="dialog"]').count()
      if (still) fail('reduced-motion', 'the sheet is still animating out — reduced motion should get the end state immediately')
    }

    /* The cascade under reduced motion, and this is the check that earns its place: the
       global rule zeroed `animation-duration` and not `animation-delay`, which cost nothing
       while no animation in the app carried a delay — the moment the cascade landed, a
       reduced-motion user would have stared at each empty slot for the length of its
       stagger, the animation holding opacity 0 through the wait. Click a tab and read the
       sections in the same breath: every one must already be exactly where it ends. */
    await page.locator('nav[aria-label="Navigation principale"] a[href="/"]').first().click()
    await page.waitForFunction(() => document.querySelector('[data-path="/"]') !== null, { timeout: 10_000 })
    const reducedCascade = await page.evaluate(() => {
      const host = document.querySelector('[data-path="/"]')
      const box = host?.querySelector('[data-cascade], .page')
      if (!box) return null
      return [...box.children].map((k) => parseFloat(getComputedStyle(k).opacity))
    })
    if (!reducedCascade) fail('reduced-motion', 'no cascade container on / to probe')
    else if (reducedCascade.some((o) => o < 1)) fail('reduced-motion', `sections are invisible after a tab change (opacities ${reducedCascade.map((o) => o.toFixed(2)).join(', ')}) — a staggered delay is surviving the reduced-motion rule`)
    await page.close()
  }

  // ---- 4. A screen says which way you went ----
  {
    const page = await newPage(context)
    await ready(page, '/crypto')

    /* Read the arrival animation off the wrapper while it is still running. Which keyframes
       are playing is the whole claim: push slides from the right, back slides from the
       left, a tab change does neither. */
    const arrivalOf = async (expected) => {
      /* Wait for the screen being asked about, not for a stopwatch. The wrapper is keyed on
         the path, so until React commits the new route the old one is still in the DOM with
         the old direction on it — which is how this check once read « back » for a tab
         change and failed on a navigation that had not happened yet. */
      await page.waitForFunction((p) => document.querySelector(`[data-path="${p}"]`) !== null, expected, { timeout: 10_000 })
      return page.evaluate((expected) => {
        const el = document.querySelector(`[data-path="${expected}"]`)
        if (!el) return { name: null, x: null, running: false }
        const cs = getComputedStyle(el)
        return {
          name: el.getAttribute('data-arrival'),
          /* The attribute says what was intended; the computed animation says whether it is
             actually playing. Both, or a screen could claim a direction and animate nothing. */
          running: cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0,
          x: Math.round(new DOMMatrix(cs.transform).m41),
        }
      }, expected)
    }

    // Push into a sub-page.
    const sub = await page.locator('a[href^="/crypto/"]').first().getAttribute('href')
    await page.locator('a[href^="/crypto/"]').first().click()
    const pushed = await arrivalOf(sub)
    if (pushed.name !== 'forward') fail('arrival', `pushing into a sub-page arrives "${pushed.name}", expected "forward"`)
    else if (!pushed.running) fail('arrival', 'the forward arrival is declared but not animating')
    else if (!(pushed.x > 0)) fail('arrival', `the forward slide is not coming from the right (x ${pushed.x})`)

    // Back out of it.
    await page.waitForTimeout(500)
    await page.goBack()
    const popped = await arrivalOf('/crypto')
    if (popped.name !== 'back') fail('arrival', `going back arrives "${popped.name}", expected "back"`)
    else if (!popped.running) fail('arrival', 'the back arrival is declared but not animating')
    else if (!(popped.x < 0)) fail('arrival', `the back slide is not coming from the left (x ${popped.x})`)

    // Switch tabs: a cross-fade, never a slide.
    await page.waitForTimeout(500)
    await page.locator('nav[aria-label="Navigation principale"] a[aria-label^="Épargne"]').first().click()
    const tabbed = await arrivalOf('/epargne')
    if (tabbed.name !== 'fade') fail('arrival', `switching tabs arrives "${tabbed.name}", expected the cross-fade — a tab change is not a stack move`)
    else if (Math.abs(tabbed.x) > 1) fail('arrival', `a tab change is sliding ${tabbed.x}px — it should only fade`)
    else notes.push('arrival: push slides in from the right, back from the left, a tab change only fades')

    /* ---- 4b. The screen's sections follow it in — the cascade ----
       The wrapper animates the screen as a whole; the cascade is the level below, and it is
       the part a screenshot can never prove: children of `.page` / `[data-cascade]` rise in
       DOM order, each a step behind the one before, capped so a long page is not still
       dealing itself out while somebody reads it. Declared delays are read *after* settle —
       computed `animation-delay` does not tick down, so the declaration is legible whenever
       we look — and the end state is read at the same time, because a cascade that leaves a
       section at 0.98 opacity for ever is worse than none. */
    const earlyHidden = await page.evaluate(() => {
      const host = document.querySelector('[data-path="/epargne"]')
      const box = host?.querySelector('[data-cascade], .page')
      if (!box) return null
      return [...box.children].filter((k) => parseFloat(getComputedStyle(k).opacity) < 0.99).length
    })
    if (earlyHidden === null) fail('cascade', '/epargne has no [data-cascade] or .page container to deal out')
    else if (earlyHidden === 0) fail('cascade', 'right after a tab change every section is already fully opaque — nothing is cascading')

    /* And the capsule went with it. It sat under the first tab for ever because the link's
       offsetParent is its own <li>, which makes every link's offsetLeft zero — invisible in
       the code, and one number here. */
    await page.waitForTimeout(700)
    const capsule = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navigation principale"]')
      const pill = nav?.querySelector('li[aria-hidden="true"]')
      const active = nav?.querySelector('[aria-current="page"]')?.closest('li')
      const box = (e) => (e ? Math.round(e.getBoundingClientRect().x) : null)
      return { pill: box(pill), active: box(active) }
    })
    if (capsule.pill === null) fail('nav', 'no capsule under the active destination')
    else if (capsule.active === null) fail('nav', 'no active destination to compare the capsule against')
    else if (Math.abs(capsule.pill - capsule.active) > 1) {
      fail('nav', `the capsule is not on the active tab (capsule at ${capsule.pill}, tab at ${capsule.active})`)
    } else notes.push(`nav: the capsule slid to the active tab at x=${capsule.pill}`)

    // The cascade, settled: declared delays in order, end state exact.
    await page.waitForTimeout(600)
    const cascade = await page.evaluate(() => {
      const host = document.querySelector('[data-path="/epargne"]')
      const box = host?.querySelector('[data-cascade], .page')
      if (!box) return null
      const step = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stagger-step')) || 0
      return {
        step,
        kids: [...box.children].map((k) => {
          const cs = getComputedStyle(k)
          return { name: cs.animationName, delay: Math.round(parseFloat(cs.animationDelay) * 1000), opacity: parseFloat(cs.opacity), transform: cs.transform }
        }),
      }
    })
    if (!cascade || cascade.kids.length < 2) fail('cascade', 'not enough sections on /epargne to measure a stagger')
    else {
      const named = cascade.kids.filter((k) => k.name.includes('cascade-in'))
      if (named.length < 2) fail('cascade', `only ${named.length} section(s) carry the cascade animation`)
      const delays = named.map((k) => k.delay)
      const ordered = delays.every((d, i) => i === 0 || d >= delays[i - 1])
      if (!ordered) fail('cascade', `delays are not in DOM order: ${delays.join(', ')}ms`)
      if (delays[delays.length - 1] === delays[0]) fail('cascade', `every section has the same delay (${delays[0]}ms) — that is a slab with extra steps, not a stagger`)
      const cap = 6 * cascade.step
      if (Math.max(...delays) > cap + 1) fail('cascade', `a section waits ${Math.max(...delays)}ms, past the ${cap}ms cap — a long page must not still be dealing itself out`)
      const unsettled = cascade.kids.filter((k) => k.opacity < 1 || (k.transform !== 'none' && k.transform !== 'matrix(1, 0, 0, 1, 0, 0)'))
      if (unsettled.length) fail('cascade', `${unsettled.length} section(s) never reached their end state (opacity 1, no transform)`)
      if (!failures.some((f) => f.startsWith('cascade:'))) notes.push(`cascade: ${named.length} sections dealt in over ${Math.max(...delays)}ms, all settled exactly`)
    }
    await page.close()
  }

  // ---- 5. A desktop dialog does not push the window back ----
  {
    /* The recession is a phone gesture. Up here the sheet is a centred dialog, and a centred
       dialog over a dimmed page is what a desktop does; scaling the whole window for it
       leaves a visible empty band along the bottom and reads as a phone shape stretched. It
       still has to arrive and leave, though — that part is not about width. */
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await newPage(wide)
    await ready(page, SHEET_ROUTE)
    const opener = await openASheet(page)
    if (!opener) fail('desktop', `found nothing on ${SHEET_ROUTE} that opens a dialog at 1440px`)
    else {
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(500)
      const view = await page.evaluate(() => {
        const v = document.querySelector('.app-view')
        const cs = v ? getComputedStyle(v) : null
        return { transform: cs?.transform, filter: cs?.filter, position: cs?.position }
      })
      if (view.transform !== 'none') fail('desktop', `the window is receding behind a centred dialog (${view.transform})`)
      if (view.filter !== 'none') fail('desktop', `the window is being dimmed behind a centred dialog (${view.filter})`)
      if (view.position === 'fixed') fail('desktop', 'the view is frozen at 1440px, where nothing needs freezing')

      await page.keyboard.press('Escape')
      await page.waitForTimeout(70)
      if (!(await page.locator('[role="dialog"]').count())) fail('desktop', 'the dialog is dismissed instantly — the exit is phone-only')
      await page.waitForTimeout(400)
      if (await page.locator('[role="dialog"]').count()) fail('desktop', 'the dialog is still in the tree after its exit')
      notes.push('desktop: a centred dialog arrives and leaves without moving the window behind it')

      /* The rail is the mobile pill stood on its end, so it carries the same capsule. It
         did not until now, and the reason was a bug: « Rechercher un actif » and « Actifs »
         both lead to /crypto, and `NavLink` wrote `aria-current="page"` on both — so two
         rows lit at once and there was no single thing to measure. */
      await ready(page, '/crypto')
      const rail = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('nav')].find((n) => {
          const r = n.getBoundingClientRect()
          return r.width > 0 && r.height > 300
        })
        if (!nav) return { missing: true }
        const lit = [...nav.querySelectorAll('[aria-current="page"]')]
        const pill = nav.querySelector('li[aria-hidden="true"]')
        const top = (e) => (e ? Math.round(e.getBoundingClientRect().top) : null)
        return {
          lit: lit.map((a) => a.getAttribute('aria-label')),
          pill: top(pill),
          active: top(lit[0]?.closest('li') ?? null),
        }
      })
      if (rail.missing) fail('desktop', 'no rail to measure at 1440px')
      else if (rail.lit.length !== 1) fail('desktop', `the rail lights ${rail.lit.length} destinations at once on /crypto: ${rail.lit.join(', ')}`)
      else if (rail.pill === null) fail('desktop', 'the rail has no capsule under its active destination')
      else if (Math.abs(rail.pill - rail.active) > 1) fail('desktop', `the rail's capsule is not on the active destination (capsule ${rail.pill}, row ${rail.active})`)
      else notes.push(`rail: one lit destination (${rail.lit[0]}), capsule on it at y=${rail.pill}`)
    }
    await page.close()
    await wide.close()
  }

  await context.close()
  await browser.close()

  for (const n of notes) console.log(`  · ${n}`)
  if (failures.length) {
    console.error(`\nMotion audit: ${failures.length} problem(s)\n` + failures.map((f) => `  ✗ ${f}`).join('\n'))
    process.exit(1)
  }
  console.log('\nMotion audit passed: springs overshoot, the sheet arrives and leaves, the page behind it recedes and comes back, reduced motion gets the end state.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
