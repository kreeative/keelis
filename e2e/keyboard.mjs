/**
 * The whole app, driven with nothing but a keyboard.
 *
 * `CLAUDE.md` says « Keyboard-complete; :focus-visible rings » — a claim nothing had ever
 * checked. The runtime audit measures contrast and tap targets, and the flow walker clicks
 * with a mouse; between them they can pass an app that a person navigating by keyboard
 * cannot use at all. The failures that matter here are silent by construction: a control
 * that takes focus without showing it, a dialog that lets focus wander out behind it, a
 * composite that swallows Tab.
 *
 * What it checks, on every route it walks:
 *
 * - **Every stop shows where it is.** A focus ring may sit on the focused element or on a
 *   wrapper above it — `Field` rings its own container on `:focus-within` precisely so the
 *   label, the leading icon and the input read as one control — so the ring is looked for
 *   up the ancestor chain, not just on the element.
 * - **Every stop is real.** Nothing focusable may be invisible, zero-sized, or `aria-hidden`:
 *   a Tab that lands somewhere unpaintable is a person's cursor vanishing.
 * - **Tab terminates.** Walking forward has to leave the document. A page that never does
 *   has trapped the user, and outside a modal dialog that is never right.
 * - **Tab is reversible.** Shift-Tab from the end has to visit the same stops in reverse.
 *   Anything else means a stop reachable in one direction only, which is how a
 *   `tabindex` typo usually presents.
 * - **Composites are one stop, not twenty — and the arrows work.** A tab list and a
 *   radiogroup take a single Tab and are steered with arrows. Both halves matter: if every
 *   segment were its own stop, reaching the content below a filter bar would cost fifteen
 *   presses; and if the arrows did nothing, that single stop would be a control a keyboard
 *   user can reach and never change.
 *
 * And four things a full sweep cannot see, checked by hand: the skip link actually moves
 * focus to the main region, a Sheet traps focus while it is open and returns it to whatever
 * opened it, Escape closes it, and an amount can be *typed* rather than only tabbed to.
 *
 * Usage: node e2e/keyboard.mjs [--only=/carte]
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7)

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

/**
 * Public pages are walked signed out, because that is who reads them.
 *
 * Both widths, because they are not the same app. Below 768px the rail is replaced by a
 * floating pill and an `AppBar`, a stepped task is three screens instead of one form, and
 * `ListRow stack` puts the value on its own line — different elements, different order,
 * different number of stops. Checking one width and claiming the other is the mistake this
 * file exists to stop being possible.
 */
const ROUTES = (process.argv.find((a) => a.startsWith('--routes='))?.slice(9)?.split(',') ?? [
  '/', '/activite', '/crypto', '/crypto/sonatel', '/crypto/sonatel/acheter', '/crypto/btc/vendre',
  '/crypto/btc/envoyer', '/crypto/btc/recevoir', '/crypto/recurrents',
  '/carte', '/carte/details', '/envoyer', '/envoyer/operateurs', '/convertir',
  '/epargne', '/epargne/deposer', '/epargne/retirer', '/epargne/objectifs/nouveau',
  '/fonds', '/profil', '/profil/informations', '/profil/securite', '/profil/notifications', '/profil/documents',
  '/profil/fiscalite', '/profil/aide', '/profil/donnees', '/profil/risque', '/notifications',
]).map((path) => ({ path }))

/* Signed out, because that is who reads them. */
const PUBLIC = ['/entreprise', '/bienvenue', '/inscription/courriel'].map((path) => ({ path, anonymous: true }))

const WIDTHS = [390, 1440]

const failures = []
const fail = (where, detail) => failures.push(`${where}: ${detail}`)

/**
 * What has focus, and everything needed to judge it.
 *
 * Read in one `evaluate` per stop: a round trip per property would turn a 40-stop page into
 * two hundred messages across the wire.
 */
const FOCUS_PROBE = () => {
  const el = document.activeElement
  if (!el || el === document.body || el === document.documentElement) return null

  const rect = el.getBoundingClientRect()
  const style = getComputedStyle(el)

  /* A ring on an ancestor counts. `Field` draws it on the wrapper via `:focus-within` so
     that the label and the input read as one control — looking only at the focused node
     would call that a failure and push someone towards a worse design. Three levels is
     enough for every wrapper in the library and short of a whole card lighting up. */
  let ring = null
  let node = el
  for (let up = 0; up <= 3 && node instanceof Element; up++) {
    const cs = up === 0 ? style : getComputedStyle(node)
    if (cs.boxShadow && cs.boxShadow !== 'none') ring = `box-shadow@${up}`
    else if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ring = `outline@${up}`
    if (ring) break
    node = node.parentElement
  }

  /* Hidden from assistive technology but not from Tab: the pairing that leaves a screen
     reader announcing nothing while the cursor has plainly moved. */
  let hiddenByAria = false
  for (let n = el; n instanceof Element; n = n.parentElement) {
    if (n.getAttribute('aria-hidden') === 'true') {
      hiddenByAria = true
      break
    }
  }

  const id =
    (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.tagName)
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 48) || el.tagName

  /* Which composite this stop belongs to, if any. Counting `role="tab"` stops across a
     whole page says nothing: Accueil carries two independent segmented controls and the
     risk questionnaire four radiogroups, and one stop each is exactly right. What is wrong
     is two stops inside *the same* group. */
  const group = el.closest('[role="tablist"], [role="radiogroup"]')
  const groupId = group ? (group.getAttribute('aria-label') || group.id || [...document.querySelectorAll('[role="tablist"], [role="radiogroup"]')].indexOf(group)) : null

  return {
    id,
    tag: el.tagName,
    role: el.getAttribute('role'),
    group: group ? `${group.getAttribute('role')}:${groupId}` : null,
    ring,
    hiddenByAria,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
    // A stable-enough identity to compare a forward walk against a backward one.
    key: `${el.tagName}|${el.getAttribute('role') ?? ''}|${id}`,
  }
}

/** Put the caret back at the top of the document so Tab starts where a fresh page does. */
async function resetFocus(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
}

/**
 * Walk forward with Tab until focus leaves the document, and report every stop.
 *
 * The bound is taken from the page rather than guessed. Activité lists every transaction
 * the account has, and a fixed ceiling of ninety called that a focus trap — the one verdict
 * this check must never get wrong, because it reads as « the app is unusable » when the
 * page is merely long.
 */
async function tabThrough(page, where) {
  const limit = await page.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, [tabindex], summary, [contenteditable]'
    return Math.max(40, [...document.querySelectorAll(sel)].filter((e) => e.getAttribute('tabindex') !== '-1').length + 10)
  })
  const stops = []
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(FOCUS_PROBE)
    if (!stop) return { stops, escaped: true }
    stops.push(stop)
  }
  fail(where, `Tab never left the page after ${limit} stops — focus is trapped outside a dialog`)
  return { stops, escaped: false }
}

function judge(where, stops) {
  if (stops.length === 0) {
    fail(where, 'nothing on the page can be reached with Tab')
    return
  }
  for (const s of stops) {
    if (!s.visible) fail(where, `« ${s.id} » takes focus while invisible (${s.width}×${s.height})`)
    else if (!s.ring) fail(where, `« ${s.id} » takes focus with no visible ring`)
    if (s.hiddenByAria) fail(where, `« ${s.id} » is aria-hidden and still in the tab order`)
  }

  /* One tab stop per composite. `SegmentedControl` is a tab list and `ChoiceList` a
     radiogroup; both are steered with arrows, so two stops inside the *same* group mean the
     roving tabindex is not roving — and a fifteen-chip filter bar that costs fifteen
     presses to get past is how a keyboard user stops using the page below it. */
  const perGroup = new Map()
  for (const s of stops) if (s.group) perGroup.set(s.group, (perGroup.get(s.group) ?? 0) + 1)
  for (const [group, n] of perGroup) {
    if (n > 1) fail(where, `${n} tab stops inside one ${group} — a composite should take one and move with arrows`)
  }
}

/**
 * Inside every composite, an arrow has to move the selection and leave it in the group.
 *
 * One tab stop and working arrows are one contract, not two: a roving tabindex that never
 * roves gives a keyboard user a segmented control they can land on and never change — which
 * looks perfect in a screenshot and in the stop count above.
 */
async function checkArrows(page, where, stops) {
  const seen = new Set()
  for (const stop of stops) {
    if (!stop.group || seen.has(stop.group)) continue
    seen.add(stop.group)

    const ready = await page.evaluate((sel) => {
      const all = [...document.querySelectorAll('[role="tablist"], [role="radiogroup"]')]
      const group = all.find((g) => `${g.getAttribute('role')}:${g.getAttribute('aria-label') || g.id || all.indexOf(g)}` === sel)
      if (!group) return 'group vanished'
      const items = [...group.querySelectorAll('[role="tab"], [role="radio"]')].filter(
        (i) => i.getAttribute('aria-disabled') !== 'true' && !i.disabled,
      )
      // A group with one live option has nothing for an arrow to do.
      if (items.length < 2) return 'single option'
      const start = items.find((i) => i.tabIndex === 0) ?? items[0]
      start.focus()
      return null
    }, stop.group)
    if (ready) continue

    /* Real key presses, not synthesised events: a handler bound to the wrong phase, or a
       control that only responds to a trusted event, is exactly the sort of thing this
       check exists to notice, and a dispatched `KeyboardEvent` would sail past it.
       Either axis is accepted — a vertical radiogroup is steered with Up/Down and a
       horizontal tab list with Left/Right — but one of them has to work. */
    let moved = false
    for (const key of ['ArrowRight', 'ArrowDown']) {
      const before = await page.evaluate(() => document.activeElement?.textContent ?? '')
      await page.keyboard.press(key)
      await page.waitForTimeout(150)
      const after = await page.evaluate(() => ({
        text: document.activeElement?.textContent ?? '',
        inside: !!document.activeElement?.closest('[role="tablist"], [role="radiogroup"]'),
      }))
      if (after.text !== before) {
        if (!after.inside) fail(where, `${key} left ${stop.group} entirely`)
        moved = true
        break
      }
    }
    if (!moved) fail(where, `neither ArrowRight nor ArrowDown moves inside ${stop.group} — it is one tab stop that cannot be changed from the keyboard`)
  }
}

async function checkReversible(page, where, forward) {
  if (forward.length < 2 || !forward.at(-1)) return
  // Focus is already past the end; Shift-Tab walks back in.
  const back = []
  for (let i = 0; i < forward.length; i++) {
    await page.keyboard.press('Shift+Tab')
    const stop = await page.evaluate(FOCUS_PROBE)
    if (!stop) break
    back.push(stop.key)
  }
  const expected = forward.map((s) => s.key).reverse()
  const n = Math.min(back.length, expected.length)
  for (let i = 0; i < n; i++) {
    if (back[i] !== expected[i]) {
      fail(where, `Shift+Tab does not retrace Tab — going back, stop ${i + 1} is « ${back[i]} » where forward said « ${expected[i]} »`)
      return
    }
  }
  if (back.length < expected.length) {
    fail(where, `Shift+Tab reaches ${back.length} of the ${expected.length} stops Tab does — something is reachable in one direction only`)
  }
}

async function walkRoute(browser, route) {
  const page = await browser.newPage({ viewport: { width: WIDTHS[0], height: 900 } })
  if (!route.anonymous) {
    await page.addInitScript((s) => {
      localStorage.setItem('keewal.session', s)
      /* Raw, not JSON. `readTheme` compares the stored string to 'light' / 'dark' directly, so
         a quoted '"light"' matched nothing and the walk silently fell back to « système » —
         which happened to look the same, and meant no walk had ever rendered the explicit
         `data-theme` path at all. */
      localStorage.setItem('keewal.theme', 'light')
    }, JSON.stringify(DEMO_SESSION))
  }
  let where = route.path
  page.on('pageerror', (e) => fail(where, `uncaught error — ${e.message}`))
  let total = 0
  try {
    await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded' })
    // The mock answers from memory after a simulated delay, so there is no network to be
    // idle about; wait for the screen to have settled into something with controls on it.
    await page.waitForTimeout(2500)
    for (const width of WIDTHS) {
      where = `${route.path} @ ${width}px`
      /* Resized rather than reloaded: the second width costs a relayout instead of a
         navigation and another two and a half seconds of simulated latency, which is the
         difference between a check CI runs and one it is quietly dropped from. */
      if (width !== WIDTHS[0]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(900)
      }
      await resetFocus(page)
      const { stops } = await tabThrough(page, where)
      judge(where, stops)
      await checkReversible(page, where, stops)
      /* Last, because it is the only check that changes the page: moving a segmented
         control redraws the chart and relists the rows under it, so anything comparing a
         walk taken before it would be comparing two different screens. */
      await checkArrows(page, where, stops)
      total += stops.length
    }
    return total
  } finally {
    await page.close()
  }
}

/** The skip link is the first stop on every screen, and it has to actually skip. */
async function checkSkipLink(browser) {
  const where = 'Le lien d’évitement'
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.addInitScript((s) => localStorage.setItem('keewal.session', s), JSON.stringify(DEMO_SESSION))
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await resetFocus(page)
    await page.keyboard.press('Tab')
    const first = await page.evaluate(FOCUS_PROBE)
    if (!/Aller au contenu/.test(first?.id ?? '')) {
      fail(where, `the first tab stop is « ${first?.id} », not the skip link — it is only useful if it comes first`)
      return
    }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const landed = await page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName)
    if (landed !== 'main') fail(where, `activating it left focus on « ${landed} » rather than moving it into the main region`)
  } finally {
    await page.close()
  }
}

/**
 * A Sheet is a modal dialog, and the three things that makes it: focus goes in, focus stays
 * in, Escape brings it back to where it came from. Without the last of those, closing a
 * confirmation drops the cursor at the top of the document and the person has to Tab all
 * the way back to the button they were on.
 */
/**
 * A sheet's list must not scroll sideways, and the check has to *hover a row* to find out.
 *
 * `ListRow`'s hover fill bleeds 12px past its container, which inside the sheet's scroll
 * body is scrollable overflow. iOS Safari keeps a tapped row in :hover, so the country picker
 * scrolled its whole list sideways under the finger — radios cut off at the edge — while
 * headless Chromium showed nothing: its mouse never rests on a row and its scrollbar paints
 * nothing. Measuring at rest passes; measuring with a row hovered is the only honest probe.
 */
async function checkSheetOverflow(browser) {
  const where = 'Le sélecteur de pays'
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.addInitScript((s) => localStorage.setItem('keewal.session', s), JSON.stringify(DEMO_SESSION))
  try {
    await page.goto(`${BASE}/profil/informations`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const opener = page.getByRole('button', { name: /Pays/ }).first()
    if ((await opener.count()) === 0) {
      fail(where, 'no country picker on /profil/informations to open')
      return
    }
    await opener.click()
    await page.waitForTimeout(700)
    const rows = page.getByRole('dialog').getByRole('radio')
    if ((await rows.count()) < 4) {
      fail(where, 'the picker opened with fewer than four rows — nothing to hover')
      return
    }
    await rows.nth(3).hover()
    const overflow = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')
      return [...dlg.querySelectorAll('*')]
        .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY))
        .map((el) => el.scrollWidth - el.clientWidth)
        .filter((d) => d > 0)
    })
    if (overflow.length) fail(where, `with a row hovered the sheet scrolls sideways by ${overflow.join(', ')}px — on a phone the list shifts and its radios are cut off`)
    await page.keyboard.press('Escape')
  } finally {
    await page.close()
  }
}

async function checkSheet(browser) {
  const where = 'La feuille de confirmation'
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.addInitScript((s) => localStorage.setItem('keewal.session', s), JSON.stringify(DEMO_SESSION))
  page.on('pageerror', (e) => fail(where, `uncaught error — ${e.message}`))
  try {
    await page.goto(`${BASE}/carte`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    const opener = page.getByRole('button', { name: /Filtrer les transactions/ }).first()
    if ((await opener.count()) === 0) {
      fail(where, 'no filter button on /carte to open a sheet with')
      return
    }
    await opener.focus()
    const before = await page.evaluate(FOCUS_PROBE)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(600)

    const dialog = page.getByRole('dialog').first()
    if ((await dialog.count()) === 0) {
      fail(where, 'pressing Enter on the filter button did not open the sheet — it is mouse-only')
      return
    }

    const inDialog = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    if (!inDialog) fail(where, 'the sheet opened without taking focus — a screen reader stays on the page behind it')

    /* Tab all the way round: every stop has to stay inside the dialog. A modal that lets
       focus reach the page behind it is a modal only to the eye. */
    let escaped = null
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return 'body'
        return el.closest('[role="dialog"]') ? 'in' : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)
      })
      if (inside !== 'in') {
        escaped = inside
        break
      }
    }
    if (escaped) fail(where, `Tab escaped the open sheet to « ${escaped} » — focus is not trapped`)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    if ((await page.getByRole('dialog').count()) > 0) fail(where, 'Escape did not close the sheet')

    const after = await page.evaluate(FOCUS_PROBE)
    if (after?.key !== before?.key) {
      fail(where, `closing it left focus on « ${after?.id ?? 'nothing'} » instead of returning it to « ${before?.id} »`)
    }
  } finally {
    await page.close()
  }
}

/**
 * You can **type** an amount, not only tab to a lozenge and press Enter.
 *
 * The walk above proves every keypad key is reachable and ringed, and it was — which is
 * exactly why it never noticed that the number row did nothing. Entering 250,000 F CFA on a
 * computer meant clicking six keys one at a time with a keyboard under your hands, on the
 * one screen whose entire job is typing a number. « Keyboard-complete » has to mean the
 * keyboard, not only the Tab key.
 *
 * Three things, because each one broke a different way while this was being built:
 * the digits reach the figure; the four operators do too (`x` as well as `*`, because that
 * is what people type); and a keystroke aimed at a text field on the same page stays in
 * that field — the grouped desktop form puts a recipient's name beside the pad, and a « 7 »
 * typed into a name belongs to the name.
 */
async function checkTypedAmount(browser) {
  const where = 'La saisie au clavier'
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.addInitScript((s) => localStorage.setItem('keewal.session', s), JSON.stringify(DEMO_SESSION))
  const figure = () => page.locator('[class*=amount]').first().getAttribute('aria-label')
  try {
    await page.goto(`${BASE}/envoyer?etape=2&mode=interne`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.keyboard.type('25000')
    await page.waitForTimeout(250)
    if (!/25\D?000/.test((await figure()) ?? '')) fail(where, `typing « 25000 » left the figure at « ${await figure()} »`)
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(200)
    if (!/2\D?500/.test((await figure()) ?? '')) fail(where, `Backspace left the figure at « ${await figure()} »`)
    await page.keyboard.type('0x3')
    await page.waitForTimeout(300)
    if (!/75\D?000/.test((await figure()) ?? '')) fail(where, `« 25000 x 3 » gave « ${await figure()} » rather than 75 000`)

    /* And the same page's text fields keep their own digits. The recipient step is where a
       name, a phone number and the pad are on screen together at this width. */
    await page.goto(`${BASE}/envoyer?mode=transfert`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const name = page.getByLabel('Nom du destinataire')
    if (await name.count()) {
      await name.fill('')
      await name.type('777')
      await page.waitForTimeout(250)
      if (await name.inputValue() !== '777') fail(where, 'the recipient field did not keep the digits typed into it')
      if (!/^\D*0\D/.test((await figure()) ?? '0')) fail(where, `digits typed into the recipient's name reached the amount: « ${await figure()} »`)
    }
  } catch (e) {
    fail(where, e.message)
  } finally {
    await page.close()
  }
}

const browser = await chromium.launch(findChromium() ? { executablePath: findChromium() } : {})
let total = 0
try {
  for (const route of [...ROUTES, ...PUBLIC]) {
    if (ONLY && route.path !== ONLY) continue
    total += await walkRoute(browser, route)
  }
  if (!ONLY) {
    await checkSkipLink(browser)
    await checkSheet(browser)
    await checkSheetOverflow(browser)
    await checkTypedAmount(browser)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`Keyboard walk — failed (${failures.length}):\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
const screens = (ONLY ? 1 : ROUTES.length + PUBLIC.length) * WIDTHS.length
console.log(`Keyboard walk: ${total} tab stops across ${screens} screens — every one visible, ringed, reversible, and no trap outside the dialog.`)
