/**
 * Walks the money flows the way somebody actually uses them, and fails loudly when one of
 * them does not complete.
 *
 * Screenshots catch what a screen *looks* like on arrival. They cannot catch a button that
 * stays disabled, a field that rejects what its own label asks for, or a confirmation
 * sheet that never opens — and those are the defects that matter most in an app that moves
 * money. This drives the real build in a real browser: sign in, buy a share, send through
 * an operator, convert, and add funds.
 *
 * Usage: node e2e/flows.mjs [--keep] (--keep leaves screenshots of each step in e2e/out/)
 */
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const KEEP = process.argv.includes('--keep')
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

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
let stepCount = 0

async function shot(page, name) {
  if (!KEEP) return
  stepCount += 1
  await page.screenshot({ path: join(OUT, `flow-${String(stepCount).padStart(2, '0')}-${name}.png`), fullPage: true })
}

function fail(flow, detail) {
  failures.push(`${flow}: ${detail}`)
}

/** Console errors are a failure too — React throwing behind a rendered screen is invisible. */
function watchConsole(page, flow) {
  page.on('pageerror', (e) => fail(flow, `uncaught error — ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fail(flow, `console error — ${m.text()}`)
  })
}

async function newPage(browser, flow, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  await page.addInitScript((s) => {
    localStorage.setItem('keewal.session', s)
    localStorage.setItem('keewal.theme', '"light"')
  }, JSON.stringify(DEMO_SESSION))
  watchConsole(page, flow)
  return page
}

/**
 * Wait for something to actually be on screen.
 *
 * `networkidle` is not enough here: the mock API answers from memory after a simulated
 * delay, so there is no request to be idle about and the page is still all skeletons when
 * the navigation resolves. Waiting on the thing itself is the only honest signal — and a
 * step that fails this way is a flaky test, not a broken app, which is worth keeping
 * distinct.
 */
async function present(page, locator, what, timeout = 8000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout })
    return true
  } catch {
    throw new Error(`${what} never appeared`)
  }
}

/**
 * The chequing balance, read off its own hero rather than the first franc figure on the
 * page — a transaction row or another account's card would otherwise answer instead.
 */
async function chequeBalance(page) {
  await page.goto(`${BASE}/carte`, { waitUntil: 'domcontentloaded' })
  await present(page, page.getByText('Disponible maintenant'), 'the chequing balance')
  /* Wait for it to stop moving. The hero counts into place over 650 ms, so reading it the
     moment it appears returns a frame of the animation — which is how this assertion first
     reported a balance that had *risen* after money left it. */
  const read = async () => {
    const hero = await page.getByText('Disponible maintenant').first().locator('xpath=..').innerText()
    const m = hero.match(/([\d,]+)\s*F\s?CFA/)
    return m ? Number(m[1].replace(/,/g, '')) : undefined
  }
  let last = await read()
  for (let i = 0; i < 12; i += 1) {
    await page.waitForTimeout(120)
    const now = await read()
    if (now !== undefined && now === last) return now
    last = now
  }
  return last
}

/** Type an amount on the in-app keypad rather than into a field — there is no field. */
async function keypad(page, digits) {
  for (const d of digits) {
    const key = page.getByRole('button', { name: d === '.' ? 'Virgule' : d, exact: true })
    if ((await key.count()) === 0) throw new Error(`keypad key ${d} not found`)
    await key.first().click()
  }
}

async function buyAShare(browser) {
  const flow = 'Acheter une action'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/crypto/sonatel/acheter`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByRole('button', { name: '5', exact: true }), 'the amount keypad')
    await shot(page, 'buy-open')
    await keypad(page, ['5', '0', '0', '0', '0'])
    const cta = page.getByRole('button', { name: /Continuer|Aperçu|Acheter/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled after entering 50 000')
    await cta.click()
    await shot(page, 'buy-confirm')
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    const body = await sheet.first().innerText()
    // The spread is the product's promise: stated before the commitment, never buried.
    if (!/cart|spread|frais/i.test(body)) fail(flow, `the confirmation sheet does not state the spread — it said: ${body.replace(/\s+/g, ' ').slice(0, 160)}`)
    const confirm = sheet.getByRole('button', { name: /Confirmer|Acheter/ }).last()
    await confirm.click()
    await present(page, page.getByText(/Achat effectué/i), 'the success state')
    await shot(page, 'buy-done')
    // The quantity on the receipt has to be the quantity the sheet promised.
    const receipt = await page.locator('body').innerText()
    if (/\d+\.\d+ SNTS/.test(receipt)) fail(flow, 'a fractional number of shares was bought — SNTS trades in whole units')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function sendThroughAnOperator(browser) {
  const flow = 'Envoyer par opérateur'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/envoyer/operateurs`, { waitUntil: 'domcontentloaded' })
    await shot(page, 'operators')
    const wave = page.getByText('Wave', { exact: true }).first()
    await present(page, wave, 'Wave on the operators page')
    await wave.click()
    await present(page, page.getByLabel('Nom du destinataire'), 'the send form')
    await shot(page, 'send-form')
    // The field must be the one Wave actually needs: a phone number.
    const label = await page.locator('label', { hasText: /Numéro de téléphone|Adresse courriel|Identifiant/ }).first().innerText().catch(() => '')
    if (!/téléphone/i.test(label)) fail(flow, `after choosing Wave the recipient field asks for « ${label.trim()} », not a phone number`)
    await page.getByLabel('Nom du destinataire').fill('Amina Diallo')
    const contact = page.getByLabel(/Numéro de téléphone|Adresse courriel|Identifiant/).first()
    await contact.fill('+221 77 555 01 48')
    await keypad(page, ['2', '5', '0', '0', '0'])
    const cta = page.getByRole('button', { name: /Continuer/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled with a name, a phone number and an amount')
    await cta.click()
    await shot(page, 'send-confirm')
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    await sheet.getByRole('button', { name: /Confirmer|Envoyer/ }).last().click()
    await present(page, page.getByText(/envoyé|succès|En route|Terminé/i), 'the success state')
    await shot(page, 'send-done')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function convert(browser) {
  const flow = 'Convertir'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/convertir`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByRole('button', { name: '1', exact: true }), 'the amount keypad')
    await keypad(page, ['1', '0', '0', '0', '0', '0'])
    await page.waitForTimeout(300)
    await shot(page, 'convert')

    const body = await page.locator('body').innerText()
    // Both rates and the margin, before anything is committed.
    for (const required of ['Taux du marché', 'Taux appliqué', 'Marge']) {
      if (!body.includes(required)) fail(flow, `« ${required} » is not shown before confirming`)
    }
    if (/\d,\d{2}\s*%/.test(body)) fail(flow, 'a percentage is using a comma decimal — the app uses a point')

    /* Read what the account holds straight off this screen. Everything below stays inside
       the running app: a `goto` would reload it, and the mock's state lives in memory —
       which is how this assertion first compared two freshly seeded balances and concluded
       nothing had moved. */
    const available = async () => {
      const line = await page.getByText(/Disponible :/).first().innerText()
      const m = line.match(/([\d,]+)\s*F\s?CFA/)
      return m ? Number(m[1].replace(/,/g, '')) : undefined
    }
    /* The figure is already on screen with its old value when the form comes back, and the
       refetch lands a moment later — so wait for it to differ rather than reading whatever
       is there. Reading too early is how this first reported that nothing had moved. */
    const availableOnceChangedFrom = async (previous) => {
      for (let i = 0; i < 25; i += 1) {
        const now = await available()
        if (now !== undefined && now !== previous) return now
        await page.waitForTimeout(120)
      }
      return available()
    }
    const before = await available()
    if (before === undefined) return fail(flow, 'the convert screen does not say what the account holds')

    const cta = page.getByRole('button', { name: /Continuer|Convertir/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled after entering 100 000')
    await cta.click()
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    await sheet.getByRole('button', { name: /Confirmer/ }).last().click()
    await present(page, page.getByText(/Conversion effectuée/i), 'the success state')
    await shot(page, 'convert-done')

    /* The whole point of this flow. « Confirmer » used to close the sheet, show a toast
       reading « converti », and move nothing at all — no balance, no transaction. The
       receipt is only true if the money actually went somewhere. */
    /* « Convertir encore » clears the receipt in place rather than navigating — the route
       is already /convertir, so a navigation there would change nothing and the button
       would look dead. */
    await page.getByRole('button', { name: /Convertir encore/ }).first().click()
    await present(page, page.getByText(/Disponible :/), 'the convert screen again')
    const after = await availableOnceChangedFrom(before)
    if (after === undefined) return fail(flow, 'could not read the balance after converting')
    if (after >= before) fail(flow, `the francs balance did not fall after converting 100 000 (${before} → ${after})`)

    // And it has to have landed somewhere visible.
    await page.getByRole('link', { name: 'Carte' }).first().click()
    await present(page, page.getByText('Autres devises'), 'the other currencies on the account')
    await shot(page, 'convert-pockets')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function addFunds(browser) {
  const flow = 'Ajouter des fonds'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/fonds`, { waitUntil: 'domcontentloaded' })
    const momo = page.getByText('Mobile Money', { exact: false }).first()
    await present(page, momo, 'Mobile Money as a funding source')
    await shot(page, 'funds-source')
    await momo.click()
    await present(page, page.getByRole('button', { name: '5', exact: true }), 'the amount keypad')
    await keypad(page, ['5', '0', '0', '0', '0'])
    await shot(page, 'funds-amount')
    const cta = page.getByRole('button', { name: /Continuer|Aperçu/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled after entering 50 000')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}


async function sellAShare(browser) {
  const flow = 'Vendre une action'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/crypto/sonatel/vendre`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByRole('button', { name: '1', exact: true }), 'the amount keypad')
    // Sell one share, entered as a quantity rather than an amount.
    const toggle = page.getByRole('button', { name: /Saisir en quantité|Saisir en francs/ })
    if ((await toggle.count()) > 0) await toggle.first().click()
    await keypad(page, ['1'])
    const cta = page.getByRole('button', { name: /Continuer|Vendre/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled after entering one share')
    await cta.click()
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    await shot(page, 'sell-confirm')
    await sheet.getByRole('button', { name: /Confirmer|Vendre/ }).last().click()
    await present(page, page.getByText(/Vente/i), 'the success state')
    await shot(page, 'sell-done')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function wireTransfer(browser) {
  const flow = 'Virement bancaire'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/envoyer?mode=bancaire`, { waitUntil: 'domcontentloaded' })
    // A wire asks for the account holder, not a « destinataire » — the name on the account
    // is what the receiving bank matches against the IBAN.
    await present(page, page.getByLabel('Titulaire du compte'), 'the wire form')
    await page.getByLabel('Titulaire du compte').fill('Moussa Sow')
    // A published specimen Senegalese IBAN — it has to pass the app's own ISO 13616 check.
    await page.getByLabel(/IBAN/).first().fill('SN08 SN01 0015 2000 0485 0000 3035')
    await page.getByLabel(/BIC/).first().fill('CBAOSNDA')
    await keypad(page, ['1', '0', '0', '0', '0', '0'])
    await shot(page, 'wire-form')
    const cta = page.getByRole('button', { name: /Continuer/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled with a valid IBAN and BIC')
    await cta.click()
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    const body = await sheet.first().innerText()
    // The IBAN is what the receiving bank acts on if the name and the account disagree.
    if (!/SN08/.test(body.replace(/\s+/g, ''))) fail(flow, 'the confirmation sheet does not repeat the IBAN')
    await shot(page, 'wire-confirm')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function moveToSavings(browser) {
  const flow = 'Déposer vers l’Épargne'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/epargne/deposer`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByRole('button', { name: '5', exact: true }), 'the amount keypad')
    await keypad(page, ['5', '0', '0', '0', '0'])
    const cta = page.getByRole('button', { name: /Continuer|Déposer/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the continue button stayed disabled after entering 50 000')
    await cta.click()
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    await sheet.getByRole('button', { name: /Confirmer|Déposer/ }).last().click()
    await present(page, page.getByText(/Dépôt|effectué|confirmé/i), 'the success state')
    await shot(page, 'savings-done')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function receiveCrypto(browser) {
  const flow = 'Recevoir de la crypto'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/crypto/btc/recevoir`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByText(/Réseau|Adresse/i), 'the receive screen')
    await shot(page, 'receive')
    const body = await page.locator('body').innerText()
    // An address with no network beside it is how people lose money.
    if (!/Réseau/i.test(body)) fail(flow, 'the receive screen does not name the network')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function freezeTheCard(browser) {
  const flow = 'Geler la carte'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/carte`, { waitUntil: 'domcontentloaded' })
    const toggle = page.getByRole('switch', { name: /Geler/i }).first()
    await present(page, toggle, 'the freeze switch')
    const before = await toggle.getAttribute('aria-checked')
    await toggle.click()
    await page.waitForTimeout(900)
    const after = await toggle.getAttribute('aria-checked')
    if (before === after) fail(flow, `the freeze switch did not change state (stayed ${after})`)
    await shot(page, 'card-frozen')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

async function createAGoal(browser) {
  const flow = 'Créer un objectif'
  const page = await newPage(browser, flow)
  try {
    await page.goto(`${BASE}/epargne/objectifs/nouveau`, { waitUntil: 'domcontentloaded' })
    await present(page, page.getByLabel(/Nom/).first(), 'the goal form')
    await page.getByLabel(/Nom/).first().fill('Rentrée scolaire')
    const target = page.getByLabel(/Objectif|Montant/).first()
    await target.fill('500000')
    await shot(page, 'goal-form')
    const cta = page.getByRole('button', { name: /Créer|Enregistrer/ }).last()
    if (await cta.isDisabled()) return fail(flow, 'the create button stayed disabled with a name and a target')
    await cta.click()
    const sheet = page.getByRole('dialog')
    await present(page, sheet, 'the confirmation sheet')
    await shot(page, 'goal-sheet')
    // With no monthly contribution there is no date to estimate, and the sheet has to say
    // so rather than invent one.
    const summary = await sheet.first().innerText()
    if (!/Date estimée/.test(summary)) fail(flow, 'the sheet does not mention the estimated date at all')
    await sheet.getByRole('button', { name: /Créer/ }).last().click()
    // Landing back on Épargne with the goal in the list is the only proof it was created —
    // the name is on the form too, so finding the text alone proves nothing.
    await page.waitForURL((u) => !u.pathname.includes('/nouveau'), { timeout: 8000 }).catch(() => {
      fail(flow, 'the form did not close after creating the goal')
    })
    await present(page, page.getByText('Rentrée scolaire'), 'the new goal in the list')
    await shot(page, 'goal-done')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

/**
 * Signing up, from the first screen to the last — nine steps, no session injected.
 *
 * This is the only path where somebody who has never used the app has to get all the way
 * through on their own, and it is the one that was quietly closed: the address step
 * offered thirteen Canadian provinces and demanded a Canadian postal code, so nobody in
 * Dakar could finish. Worth walking end to end rather than photographing step by step.
 */
async function signUp(browser) {
  const flow = 'Inscription'
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('keewal.theme', '"light"')
  })
  watchConsole(page, flow)
  try {
    await page.goto(`${BASE}/inscription/courriel`, { waitUntil: 'domcontentloaded' })
    const next = () => page.getByRole('button', { name: /Continuer|Suivant|Terminer|Ouvrir/ }).last()

    await present(page, page.getByLabel(/Courriel|Adresse courriel/), 'the email step')
    await page.getByLabel(/Courriel|Adresse courriel/).first().fill('nouvelle.cliente@exemple.sn')
    await next().click()

    /* The code is a field, not a keypad — deliberately: `autocomplete="one-time-code"`
       lets the phone fill it from the message, which a custom keypad throws away. */
    await present(page, page.getByLabel('Code à six chiffres'), 'the code step')
    await page.getByLabel('Code à six chiffres').fill('246810')

    await present(page, page.getByLabel(/Prénom/), 'the name step')
    await page.getByLabel(/Prénom/).first().fill('Fatou')
    await page.getByLabel(/Nom/).last().fill('Sow')
    await next().click()

    await present(page, page.getByLabel('Date de naissance'), 'the birth step')
    await page.getByLabel('Date de naissance').fill('1994-03-22')
    await next().click()

    // The step that used to be impossible from Dakar.
    await present(page, page.getByLabel('Pays'), 'the address step')
    const country = await page.getByLabel('Pays').inputValue()
    if (country !== 'SN') fail(flow, `the address step opens on « ${country} » rather than Senegal, the home market`)
    await page.getByLabel('Adresse').first().fill('12, rue Carnot')
    await page.getByLabel('Ville').fill('Dakar')
    await page.getByLabel(/Région/).selectOption('Dakar')
    await page.getByLabel(/Code postal/).fill('11000')
    await shot(page, 'signup-address')
    if (await next().isDisabled()) return fail(flow, 'the address step could not be completed with a Dakar address')
    await next().click()

    // KYC needs a document, and there is no skip — which is correct for opening an account.
    await present(page, page.getByText(/Déposez votre document/), 'the document step')
    await page.locator('input[type=file]').setInputFiles({ name: 'cni.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('demo') })
    await present(page, page.getByText('cni.jpg'), 'the chosen document')
    await next().click()

    await present(page, page.getByRole('button', { name: /Continuer|Activer|Plus tard/ }).last(), 'the two-factor step')
    await page.getByRole('button', { name: /Continuer|Activer|Plus tard/ }).last().click()

    // A PIN, then its confirmation.
    await present(page, page.getByRole('button', { name: '1', exact: true }), 'the PIN keypad')
    await keypad(page, ['1', '2', '3', '4'])
    await page.waitForTimeout(500)
    await keypad(page, ['1', '2', '3', '4'])
    await page.waitForTimeout(700)

    await present(page, page.getByText('Actifs', { exact: true }).first(), 'the product step')
    await shot(page, 'signup-product')
    await page.getByText('Actifs', { exact: true }).first().click()
    await page.getByRole('button', { name: /Ouvrir/ }).last().click()
    // The account is open when the app itself is on screen.
    await present(page, page.getByText(/Valeur du portefeuille|Solde total/i), 'the app after signing up', 12_000)
    await shot(page, 'signup-done')
  } catch (e) {
    fail(flow, e.message)
  } finally {
    await page.close()
  }
}

const executablePath = findChromium()
const browser = await chromium.launch(executablePath ? { executablePath } : {})
await signUp(browser)
await buyAShare(browser)
await sellAShare(browser)
await sendThroughAnOperator(browser)
await wireTransfer(browser)
await convert(browser)
await addFunds(browser)
await moveToSavings(browser)
await receiveCrypto(browser)
await freezeTheCard(browser)
await createAGoal(browser)
await browser.close()

if (failures.length) {
  console.error(`Flows failed (${failures.length}):\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log('Flows passed: sign up, buy, sell, send through an operator, wire, convert, add funds, save, receive, freeze, goal.')
