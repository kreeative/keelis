import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium')) continue
    for (const c of ['chrome-linux/chrome','chrome-linux64/chrome','chrome']) {
      const p = join(root, dir, c); if (existsSync(p) && statSync(p).isFile()) return p
    }
  }
}
const DEMO = { user:{id:'usr_01',firstName:'Aïssatou',lastName:'Ndiaye',email:'a@b.sn',verified:true,twoFactorEnabled:true,biometricsEnabled:false,pinSet:true,locale:'fr-SN',createdAt:new Date().toISOString()}, token:'e2e', expiresAt:new Date(Date.now()+86400000).toISOString() }
mkdirSync('e2e/out/steps', { recursive: true })
const b = await chromium.launch({ executablePath: findChromium() })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.addInitScript((s)=>{ localStorage.setItem('keewal.session', s); localStorage.setItem('keewal.theme','light') }, JSON.stringify(DEMO))
await page.goto('http://localhost:4173/envoyer', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('nav:visible'); await page.waitForTimeout(1500)

const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: `e2e/out/steps/envoyer-${n}.png` }) }
const eyebrow = async () => { await page.waitForTimeout(500); return page.evaluate(() => {
  const h = document.querySelector('header')
  return (h?.querySelector('.t-label')?.textContent ?? '(none)') + '  url=' + location.search
}) }

console.log('step1', await eyebrow()); await shot('1-methode')
await page.getByRole('button', { name: 'Continuer' }).click()
console.log('step2', await eyebrow()); await shot('2-destinataire')
// Fill the recipient so the flow can advance.
await page.getByLabel('Nom du destinataire').fill('Amina Diop')
await page.locator('a[href^="/envoyer/operateurs"]').click()
await page.waitForTimeout(900)
await page.locator('button, a').filter({ hasText: /Wave/ }).first().click()
await page.waitForTimeout(1200)
console.log('back at', await eyebrow())
const nameKept = await page.getByLabel('Nom du destinataire').inputValue()
console.log('name kept:', JSON.stringify(nameKept))
await page.screenshot({ path: 'e2e/out/steps/envoyer-2b-operator.png' })
await page.getByLabel(/Numéro de téléphone/i).fill('+221 77 123 45 67')
await page.getByRole('button', { name: 'Continuer' }).click()
console.log('step3', await eyebrow()); await shot('3-montant')
for (const d of ['2','5','0','0','0']) await page.getByRole('button', { name: d, exact: true }).click()
await page.getByRole('button', { name: 'Continuer' }).click()
console.log('step4', await eyebrow()); await shot('4-apercu')
await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
await page.waitForTimeout(900); await page.screenshot({ path: 'e2e/out/steps/envoyer-5-confirm.png' })
await b.close()
