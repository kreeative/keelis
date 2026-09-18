/**
 * Turns a source photograph into the files `public/photos/README.md` asks for.
 *
 *     node scripts/photo-import.mjs welcome ~/Pictures/mask.jpg
 *
 * **It uses the Chromium that is already here**, through `playwright-core`, rather than
 * adding an image library. The repository is JavaScript and nothing else, and that rule has
 * already paid for itself once — `tint-mark.mjs` was Python for one script. A browser decodes
 * every format a browser will later display, which is exactly the set that matters.
 *
 * **There is no AVIF, and that is measured rather than assumed.** Chromium's
 * `canvas.toDataURL('image/avif')` does not fail — it **silently returns a PNG**, probed here
 * before this was written. Had that gone unchecked the app would serve PNG bytes from a
 * `<source type="image/avif">`: several times the weight, chosen first by every modern
 * browser, with nothing anywhere reporting a problem. WebP covers every phone this app is
 * for, and a JPEG sits behind it. If AVIF is ever worth a real encoder, add the encoder —
 * do not trust the canvas.
 *
 * **It never upscales.** A 1000px source asked to fill a 1600px slot is the same pixels with
 * more bytes, and a `srcset` advertising a width the file does not have makes the browser
 * choose the heavier of two identical pictures. The widths actually produced are printed at
 * the end, to be pasted into the slot's `widths` in `src/lib/photos.ts`.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'public/photos')
const WANTED = [800, 1600]
/* Quality, chosen per format rather than shared: WebP holds detail at a lower number than
   JPEG does, and the JPEG is only ever the fallback. */
const QUALITY = { webp: 0.82, jpg: 0.86 }
const MIME = { webp: 'image/webp', jpg: 'image/jpeg' }

const [slot, source] = process.argv.slice(2)
if (!slot || !source) {
  console.error('usage: node scripts/photo-import.mjs <slot> <source-image>')
  process.exit(1)
}
const src = resolve(source)
const bytes = readFileSync(src)
const ext = extname(src).toLowerCase().replace('.', '') || 'jpg'
const dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${bytes.toString('base64')}`

mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await (await browser.newContext()).newPage()

const encoded = await page.evaluate(
  async ({ dataUrl, wanted, quality, mime }) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const out = []
    for (const w of wanted) {
      /* Never upscale: a source narrower than the slot gives its own width, once. */
      const width = Math.min(w, img.naturalWidth)
      if (out.some((o) => o.width === width)) continue
      const height = Math.round((width / img.naturalWidth) * img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const cx = c.getContext('2d')
      cx.imageSmoothingEnabled = true
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(img, 0, 0, width, height)
      const files = {}
      for (const [k, m] of Object.entries(mime)) {
        const url = c.toDataURL(m, quality[k])
        const got = url.slice(5, url.indexOf(';'))
        /* The canvas answers a format it cannot encode with a PNG and no error. Refuse it
           rather than write bytes whose name lies about what they are. */
        if (got !== m) throw new Error(`canvas returned ${got} when asked for ${m} — this build cannot encode it`)
        files[k] = url.slice(url.indexOf(',') + 1)
      }
      out.push({ width, height, files })
    }
    return { natural: [img.naturalWidth, img.naturalHeight], out }
  },
  { dataUrl, wanted: WANTED, quality: QUALITY, mime: MIME },
)
await browser.close()

const widths = []
for (const { width, height, files } of encoded.out) {
  widths.push(width)
  for (const [k, b64] of Object.entries(files)) {
    const path = join(DIR, `${slot}-${width}.${k}`)
    writeFileSync(path, Buffer.from(b64, 'base64'))
    console.log(`  ${slot}-${width}.${k}  ${width}×${height}  ${Math.round(statSync(path).size / 1024)} KB`)
  }
}
console.log(`\nSource ${encoded.natural[0]}×${encoded.natural[1]}.`)
console.log(`Paste into src/lib/photos.ts → ${slot}: widths: [${widths.join(', ')}]`)
if (widths.length < WANTED.length) console.log(`Note: the source is narrower than ${WANTED[WANTED.length - 1]}px, so only ${widths.join(' and ')} could be produced without upscaling.`)
