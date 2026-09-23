/**
 * The whole application, talking HTTP to the reference back-end.
 *
 * This is the only evidence that « connecter un back-end » actually works. Everything else
 * is a proxy for it: the REST client is unit-tested against a fake `fetch`, and a test keeps
 * `docs/API.md` from drifting away from the client — but neither has ever put a request on a
 * socket. Here the real build, compiled with `VITE_API_URL` set (and therefore with the mock
 * stripped out of the bundle entirely), runs against a server that answers the documented
 * contract.
 *
 * It boots both processes, drives a handful of paths that touch most of the surface, and
 * tears them down. Then it does the other half, which matters just as much on the first
 * day: it points the same build at a **broken** back-end and checks the app fails the way
 * it should. Run it with `pnpm e2e:server`.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const API_PORT = 8788
const APP_PORT = 4175
const API = `http://localhost:${API_PORT}/v1`
const APP = `http://localhost:${APP_PORT}`
const ROOT = new URL('..', import.meta.url).pathname

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

/**
 * Every child runs in its own process group, and teardown kills the group.
 *
 * `npx vite preview` is two processes: killing the `npx` leaves the `vite` it spawned
 * running, reparented to init, still holding the port. That is not a tidiness problem. The
 * next run finds the port busy, vite rolls silently forward to the next free one, and the
 * walk drives *the previous build* while reporting that the back-end never answered — which
 * is how 41 of these accumulated before anyone looked.
 */
const children = []
function run(command, args, env = {}) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  return child
}
function stopAll() {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}
// Ctrl-C has to clean up too, or an interrupted run leaves the same ghost behind.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stopAll(), process.exit(130)))

async function waitFor(url, what, timeout = 90_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`${what} never came up at ${url}`)
}

async function assertServingTheConfiguredBuild() {
  const html = await (await fetch(APP)).text()
  const chunk = html.match(/\/assets\/(index-[\w-]+\.js)/)?.[1]
  if (!chunk) throw new Error(`the app at ${APP} served an index with no entry chunk — is that really the build?`)
  if (!existsSync(join(ROOT, 'dist-server/assets', chunk))) {
    throw new Error(`${APP} is serving ${chunk}, which is not in dist-server — something else holds that port`)
  }
  /* And the build really is configured: no chunk of it carries the mock's seed. */
  const assets = join(ROOT, 'dist-server/assets')
  const seeded = readdirSync(assets).filter((f) => f.endsWith('.js') && readFileSync(join(assets, f), 'utf8').includes('Marché Kermel'))
  if (seeded.length) fail(`the configured build still carries the mock seed (${seeded.join(', ')})`)
}

/* Both ports have to be ours. Something already answering means a leftover process from an
   earlier run, and every figure the walk reads after that would be somebody else's. */
async function assertFree(port, what) {
  const answered = await fetch(`http://localhost:${port}/`).then(() => true).catch(() => false)
  if (answered) throw new Error(`something is already listening on ${port} — stop it before running ${what}`)
}

/**
 * Stop the reference back-end so a broken one can take its port.
 *
 * The app is already built against this exact URL, so swapping what answers there is how
 * one build covers both halves — the alternative is compiling the whole app twice.
 */
async function stopReference() {
  const ref = children.shift()
  if (ref) {
    try {
      process.kill(-ref.pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
  // Wait for the port to actually free, or the broken server cannot bind it.
  for (let i = 0; i < 40; i++) {
    const stillUp = await fetch(`${API}/accounts`).then(() => true).catch(() => false)
    if (!stillUp) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('the reference back-end would not let go of its port')
}

/** A back-end that is reachable and wrong, in one of the two ways that actually happen. */
function startBroken(mode) {
  const server = createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': req.headers.origin ?? '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      return res.end()
    }
    if (mode === 'html') {
      // What an API URL pointed at the app's own origin returns for every path.
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html' })
      return res.end('<!doctype html><title>app</title>')
    }
    res.writeHead(500, { ...cors, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'server', message: 'boom' } }))
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(API_PORT, () => resolve(server))
  })
}

const failures = []
const fail = (m) => failures.push(m)

try {
  await assertFree(API_PORT, 'the back-end walk')
  await assertFree(APP_PORT, 'the back-end walk')

  console.log('Starting the reference back-end…')
  run('node', ['server/reference.mjs'], { PORT: String(API_PORT) })
  await waitFor(`${API}/accounts`, 'the reference back-end')

  /* A configured build: this is also what proves the mock is gone — the same Rollup
     branch that keeps invented balances out of a real bundle. */
  console.log('Building the app against it…')
  await new Promise((resolve, reject) => {
    const build = run('npx', ['vite', 'build', '--outDir', 'dist-server'], { VITE_API_URL: API })
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed (${code})`))))
  })

  /* `--strictPort`, and then a check that the thing answering is the build we just made.
     Without the first, a stray preview left behind by an earlier run holds the port, vite
     rolls silently forward to the next one, and the walk happily drives the *mock* build
     while reporting that the back-end did not answer. Without the second, any other way of
     serving the wrong directory tells the same lie. The evidence is cheap: the index has to
     name a chunk that exists in `dist-server`. */
  run('npx', ['vite', 'preview', '--port', String(APP_PORT), '--strictPort', '--outDir', 'dist-server'])
  await waitFor(APP, 'the app')
  await assertServingTheConfiguredBuild()

  const executablePath = findChromium()
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.on('pageerror', (e) => fail(`uncaught error — ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) fail(`console error — ${m.text()}`)
  })

  /* The stream has to be *open*, not merely attempted. When `/events` is refused the client
     falls back to polling and the app keeps working — which is the point of the fallback and
     also why the failure is invisible: nothing breaks, every settlement just arrives seconds
     late, for the rest of the session. Only the response tells you which of the two is
     running. */
  let stream = 0
  page.on('response', (r) => {
    if (r.url().endsWith('/events') && r.status() === 200) stream++
  })

  // Sign in the way somebody would: the real code, over the real transport.
  await page.goto(`${APP}/inscription/courriel?mode=connexion`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Adresse courriel').waitFor({ timeout: 20_000 })
  await page.getByLabel('Adresse courriel').fill('aissatou.ndiaye@exemple.sn')
  await page.getByRole('button', { name: /Continuer/ }).last().click()
  await page.getByLabel('Code à six chiffres').waitFor({ timeout: 15_000 })
  await page.getByLabel('Code à six chiffres').fill('246810')

  const wait = async (pattern, what, timeout = 20_000) => {
    const deadline = Date.now() + timeout
    /* Case-insensitive on purpose. `innerText` returns text as *rendered*, and a section
       title is uppercased by `.t-section` — so « Autres devises » reaches the walker as
       « AUTRES DEVISES » and a pattern copied from the source never matches. That reads as
       a missing section, which is the most alarming way for a passing app to fail. */
    const re = new RegExp(pattern.source, pattern.flags.includes('i') ? pattern.flags : pattern.flags + 'i')
    let last = ''
    while (Date.now() < deadline) {
      /* Normalised: the app sets narrow no-break spaces inside figures — « 1 SNTS » is
         not typed with the space on your keyboard — so a pattern written with an ordinary
         space would never match what is on screen. */
      last = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
      if (re.test(last)) return
      await page.waitForTimeout(250)
    }
    fail(`${what} — the screen said: ${last.replace(/\s+/g, ' ').slice(0, 160)}`)
  }

  await wait(/Solde total/, 'the app never opened after signing in over HTTP')

  /* Figures that can only have come from the server: the balances, the holdings, the
     currencies the account holds beside its francs. */
  await wait(/2,766,500/, 'the chequing balance did not arrive from the back-end')
  await page.goto(`${APP}/carte`, { waitUntil: 'domcontentloaded' })
  /* The figure, not just the heading: it proves the pocket crossed the wire *and* that the
     app's punctuation rule — comma groups, point decimal — survives a real payload. */
  await wait(/Autres devises/, 'the currency pockets did not arrive from the back-end')
  await wait(/1,240\.50/, 'the euro pocket did not render as the back-end reported it')
  await page.goto(`${APP}/crypto`, { waitUntil: 'domcontentloaded' })
  await wait(/SNTS/, 'the holdings did not arrive from the back-end')

  // A write, and its consequence: the quote and the order both cross the wire.
  await page.goto(`${APP}/crypto/sonatel/acheter`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '5', exact: true }).first().waitFor({ timeout: 15_000 })
  for (const d of ['5', '0', '0', '0', '0']) await page.getByRole('button', { name: d, exact: true }).first().click()
  /* Two steps, not one: the amount, then the aperçu, then the sheet. This walk pressed one
     button and waited for the dialog, and had been failing since the flows were stepped —
     on main, before any change in the batch that fixed it. An instrument nobody runs is an
     instrument that is wrong for as long as nobody runs it. */
  await page.getByRole('button', { name: /^Continuer$/ }).last().click()
  await page.getByRole('button', { name: /^Acheter$/ }).last().waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Acheter$/ }).last().click()
  await page.getByRole('dialog').waitFor({ timeout: 15_000 })
  await page.getByRole('dialog').getByRole('button', { name: /Confirmer|Acheter/ }).last().click()
  await wait(/Achat effectué/, 'the order did not complete against the back-end')

  // And the stream: a transaction posted by the server, seen without a refresh.
  await wait(/1 SNTS/, 'the receipt does not show a whole share')
  if (stream === 0) fail('the event stream never opened — the app is polling, not listening')
  await page.close()

  /* The other half: the same build, pointed at a back-end that is answering badly.
     This is the first day, not the steady state — a half-deployed service, an API URL one
     path segment off — and an app that mishandles it sends whoever is wiring it up looking
     in the wrong place. Both modes below were real defects. */
  console.log('Now against a back-end that is answering badly…')
  await stopReference()
  for (const [mode, what] of [
    ['500', 'a service that is falling over'],
    ['html', 'an API URL aimed at the app itself, so every path answers index.html'],
  ]) {
    const broken = await startBroken(mode)
    const p = await browser.newPage({ viewport: { width: 390, height: 900 } })
    const crashes = []
    p.on('pageerror', (e) => crashes.push(e.message))
    try {
      await p.goto(`${APP}/inscription/courriel?mode=connexion`, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(6_000)
      const text = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')

      // It has to say something, and it has to be the app's own sentence.
      if (!/Réessayer/.test(text)) fail(`with ${what}, the app offered no way to retry — it said: ${text.slice(0, 160)}`)
      if (/\bboom\b/.test(text)) fail(`with ${what}, the server's own log line reached the screen: ${text.slice(0, 160)}`)
      if (/doctype|<title>/i.test(text)) fail(`with ${what}, a raw response body reached the screen`)
      if (crashes.length) fail(`with ${what}, the app threw rather than failing: ${crashes[0]}`)
    } finally {
      await p.close()
      await new Promise((r) => broken.close(r))
    }
  }

  await browser.close()
} catch (e) {
  fail(e.message)
} finally {
  stopAll()
}

if (failures.length) {
  console.error(`Against the reference back-end — failed (${failures.length}):\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log('Against the reference back-end: signed in, read accounts, holdings and pockets, placed an order — all over HTTP.\nAgainst a broken one: failed with its own sentence and a way to retry, without throwing or repeating the server.')
