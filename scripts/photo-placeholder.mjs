/**
 * Writes obviously-fake stand-in images into `public/photos/`, so the illustrated layout can
 * be rendered and audited **before the licensed photographs exist**.
 *
 * The alternative was shipping a layout whose illustrated path had never once been on screen,
 * which is the thing this repository keeps being bitten by: the notch, the scrollbars and the
 * dark theme were all code that looked right and had never been rendered under the condition
 * it was written for. A seam nobody has run is a seam nobody has tested.
 *
 * **They are deliberately not photographs, and must never be mistaken for one.** Each frame
 * is a warm value-fall with a lit ellipse where a subject would sit and the word PLACEHOLDER
 * struck across it — enough to exercise the crop, the scrim and the contrast maths, and
 * impossible to leave in by accident. `.gitignore` refuses to commit them, for the same
 * reason it refuses to commit `.env`: an unlicensed image is a problem that survives the
 * commit which removed it.
 *
 * **Every frame carries a marker in its own bytes**, a PNG `tEXt` chunk reading
 * `KEEWAL-PLACEHOLDER`, and a test fails on any image under `public/photos/` that has one.
 * That guard used to be a `.gitignore` path, which was wrong in a way worth remembering: the
 * site builds from the repository, so ignoring the folder guaranteed the deployed app had no
 * photographs at all. A stand-in and a real photograph share the same filenames on purpose —
 * the whole point is that dropping the real ones in changes nothing else — so a path can
 * never tell them apart. A marker inside the file can, and it survives being copied, renamed
 * and re-committed.
 *
 * They are PNG bytes written under `.webp` / `.jpg` names. A browser decodes an
 * image by its content, not its extension, so a `<picture>` selects a source by the declared
 * `type` and then renders these fine — which is exactly the code path the real files will
 * take. No second toolchain and no dependency: this repository is JavaScript, and `node:zlib`
 * plus the PNG filtering is all a stand-in needs.
 *
 *     node scripts/photo-placeholder.mjs          # write them
 *     node scripts/photo-placeholder.mjs --clean  # remove them
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'public/photos')
const WIDTHS = [800, 1600]
const EXTS = ['webp', 'jpg']
const SLOTS = ['welcome', 'company']

// ---------- PNG ----------
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
let TABLE = null
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      TABLE[n] = c
    }
  }
  let c = -1
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
/** The marker that says « this is not a photograph », carried inside the file. */
export const PLACEHOLDER_MARKER = 'KEEWAL-PLACEHOLDER'

function png(width, height, pixels) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none — these compress well enough and stay simple
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'ascii')
    data.copy(out, 8)
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  /* `tEXt` is keyword\0text, Latin-1, and it may appear before IDAT. Decoders ignore what
     they do not recognise, so this changes nothing about how the frame renders. */
  const text = Buffer.concat([Buffer.from('Comment', 'latin1'), Buffer.from([0]), Buffer.from(PLACEHOLDER_MARKER, 'latin1')])
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('tEXt', text),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* A 5×7 stroke font, enough for the one word these frames have to say. */
const GLYPHS = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
}

function frame(width, height, label) {
  const px = Buffer.alloc(width * height * 4)
  const cx = width * 0.42
  const cy = height * 0.38
  const rx = width * 0.3
  const ry = height * 0.26
  for (let y = 0; y < height; y++) {
    /* A warm value-fall, deep at the foot — the brief in public/photos/README.md asks for a
       dark subject under a single light, and the scrim is tuned against exactly that. */
    const t = y / (height - 1)
    const base = 34 - 18 * t
    for (let x = 0; x < width; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      const lit = d < 1 ? (1 - Math.sqrt(d)) ** 1.6 : 0
      const v = base + lit * 120
      const i = (y * width + x) * 4
      px[i] = Math.min(255, Math.round(v * 1.0))
      px[i + 1] = Math.min(255, Math.round(v * 0.82))
      px[i + 2] = Math.min(255, Math.round(v * 0.55))
      px[i + 3] = 255
    }
  }
  // The word, struck across the middle so no crop can hide it.
  const scale = Math.max(2, Math.round(width / 150))
  const w = label.length * 6 * scale
  const ox = Math.round((width - w) / 2)
  const oy = Math.round(height * 0.52)
  label.split('').forEach((ch, n) => {
    const g = GLYPHS[ch]
    if (!g) return
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '1') continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = ox + (n * 6 + c) * scale + dx
            const y = oy + r * scale + dy
            if (x < 0 || y < 0 || x >= width || y >= height) continue
            const i = (y * width + x) * 4
            px[i] = 255
            px[i + 1] = 240
            px[i + 2] = 200
          }
        }
      }
    }
  })
  return png(width, height, px)
}

// ---------- run ----------
const clean = process.argv.includes('--clean')
mkdirSync(DIR, { recursive: true })
if (clean) {
  let n = 0
  for (const f of readdirSync(DIR)) {
    if (f === 'README.md') continue
    rmSync(join(DIR, f))
    n++
  }
  console.log(`Removed ${n} placeholder file(s).`)
} else {
  let n = 0
  for (const slot of SLOTS) {
    for (const width of WIDTHS) {
      const buf = frame(width, Math.round(width * 1.25), 'PLACEHOLDER')
      for (const ext of EXTS) {
        writeFileSync(join(DIR, `${slot}-${width}.${ext}`), buf)
        n++
      }
    }
  }
  console.log(`Wrote ${n} placeholder file(s) into public/photos/. Each carries the KEEWAL-PLACEHOLDER marker, and a test refuses to let one be committed; run with --clean to remove.`)
  console.log('Set `present: true` in src/lib/photos.ts to render the illustrated layout.')
}
