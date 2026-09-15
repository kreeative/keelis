#!/usr/bin/env node
/**
 * Tint the monogram discs into the palette, without redrawing them.
 *
 * The brand sheet draws the K disc *embossed* — a raised letter, a lit rim, a soft shadow —
 * and both exports are pure greyscale (measured: zero chroma on every opaque pixel). That was
 * invisible while the app was monochrome. On warm brown it is not: a neutral disc among warm
 * neutrals reads as a cold patch, the same failure the token guard now catches for `oklch(L 0 0)`.
 *
 * So this maps each grey to the *same lightness* in the warm family and leaves everything else
 * alone. It is a tint, not a trace: the emboss is entirely carried by relative lightness, and
 * that is exactly what is preserved. `CLAUDE.md` forbids replacing the disc with a drawn
 * circle, and this does not — the artwork is the artwork, wearing the palette's colour.
 *
 * Chroma is gamut-mapped per level rather than clamped: near white, `oklch(0.98 0.03 88)` is
 * outside sRGB, and clipping a channel shifts the hue instead of reducing the saturation.
 *
 * The greyscale exports stay in `brand-src/`, which is not served, so a different warmth is one
 * edit and a re-run away rather than a re-export.
 *
 * **Node, with no dependencies.** This was Python — Pillow and numpy — and it was the only
 * Python in a TypeScript repository: a second toolchain, a second set of packages to have
 * installed, for one 85-line script. The PNGs here are 8-bit RGBA and not interlaced, which
 * `node:zlib` plus fifty lines of filtering handles exactly. `--check` re-runs the whole
 * thing and compares the result to what is committed, so this file and `public/brand/` cannot
 * drift apart the way a one-off script and its output usually do.
 *
 *     node scripts/tint-mark.mjs           — write the tinted PNGs
 *     node scripts/tint-mark.mjs --check   — fail if what is committed is not what this makes
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* (source, destination, chroma, hue). The paper disc goes on dark brown surfaces and the
   always-dark card; the ink disc goes on the cream page. Both stay near-neutral: this is a
   surface, not the accent, so it borrows the warmth without borrowing the gold. */
const JOBS = [
  { src: 'brand-src/mark-paper-grey.png', dst: 'public/brand/mark-paper.png', chroma: 0.03, hue: 88 },
  { src: 'brand-src/mark-ink-grey.png', dst: 'public/brand/mark-ink.png', chroma: 0.026, hue: 68 },
]

// ---------- colour ----------

/** oklch → linear sRGB. Returns values that may sit outside [0,1]: that is the gamut test. */
function oklchToLinearSrgb(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055)

/** oklch L of a neutral: every channel is equal, so the cube roots collapse to one. */
const lightnessOfGrey = (g) => Math.cbrt(srgbToLinear(g / 255))

/** 256 greys → 256 warm RGB triples, chroma reduced per level until it is in gamut. */
function buildLut(chroma, hue) {
  const out = new Uint8Array(256 * 3)
  for (let g = 0; g < 256; g++) {
    const L = lightnessOfGrey(g)
    let c = chroma
    let lin
    for (;;) {
      lin = oklchToLinearSrgb(L, c, hue)
      const lo = Math.min(...lin)
      const hi = Math.max(...lin)
      if (c <= 0.0005 || (lo >= -0.001 && hi <= 1.001)) break
      c *= 0.95
    }
    for (let i = 0; i < 3; i++) {
      out[g * 3 + i] = Math.round(Math.min(255, Math.max(0, linearToSrgb(lin[i]) * 255)))
    }
  }
  return out
}

// ---------- PNG ----------

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** CRC-32, the one PNG puts after every chunk. */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit RGBA, non-interlaced PNG to {width, height, pixels}. */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG')
  let off = 8
  let width = 0
  let height = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const [depth, colorType, , , interlace] = [data[8], data[9], data[10], data[11], data[12]]
      /* Everything below assumes four 8-bit channels laid out row by row. Anything else
         needs code that is not here, so say so rather than producing a wrong picture. */
      if (depth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`)
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const pixels = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= bpp ? prev[i - bpp] : 0
      const x = line[i]
      out[i] =
        filter === 0 ? x
        : filter === 1 ? (x + a) & 0xff
        : filter === 2 ? (x + b) & 0xff
        : filter === 3 ? (x + ((a + b) >> 1)) & 0xff
        : filter === 4 ? (x + paeth(a, b, c)) & 0xff
        : (() => {
            throw new Error(`unknown PNG filter ${filter}`)
          })()
    }
  }
  return { width, height, pixels }
}

/** Encode 8-bit RGBA to PNG, choosing a filter per row the way encoders do. */
function encodePng(width, height, pixels) {
  const bpp = 4
  const stride = width * bpp
  const raw = Buffer.alloc(height * (stride + 1))
  const candidate = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const line = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    let best = 0
    let bestScore = Infinity
    let bestLine = null
    for (let f = 0; f <= 4; f++) {
      let score = 0
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0
        const b = prev ? prev[i] : 0
        const c = prev && i >= bpp ? prev[i - bpp] : 0
        const v =
          f === 0 ? line[i]
          : f === 1 ? (line[i] - a) & 0xff
          : f === 2 ? (line[i] - b) & 0xff
          : f === 3 ? (line[i] - ((a + b) >> 1)) & 0xff
          : (line[i] - paeth(a, b, c)) & 0xff
        candidate[i] = v
        // The standard heuristic: smallest sum of absolute signed differences compresses best.
        score += v < 128 ? v : 256 - v
      }
      if (score < bestScore) {
        bestScore = score
        best = f
        bestLine = Buffer.from(candidate)
      }
    }
    raw[y * (stride + 1)] = best
    bestLine.copy(raw, y * (stride + 1) + 1)
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
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- run ----------

/** Tint one file; returns the PNG bytes rather than writing, so `--check` can compare. */
function tint({ src, chroma, hue }) {
  const { width, height, pixels } = decodePng(readFileSync(join(ROOT, src)))
  const lut = buildLut(chroma, hue)
  const out = Buffer.alloc(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    /* The source is neutral, so the red channel *is* the grey level. Alpha is copied
       untouched: the emboss's soft shadow lives in it. */
    const g = pixels[i]
    out[i] = lut[g * 3]
    out[i + 1] = lut[g * 3 + 1]
    out[i + 2] = lut[g * 3 + 2]
    out[i + 3] = pixels[i + 3]
  }
  return encodePng(width, height, out)
}

const check = process.argv.includes('--check')
let drifted = 0
for (const job of JOBS) {
  const png = tint(job)
  const path = join(ROOT, job.dst)
  if (check) {
    /* Compare *pixels*, not bytes: two encoders can spell the same picture differently and
       a byte comparison would fail on a zlib version bump rather than on a real change. */
    const want = decodePng(png)
    const have = decodePng(readFileSync(path))
    const same = want.width === have.width && want.height === have.height && want.pixels.equals(have.pixels)
    if (!same) {
      console.error(`  ✗ ${job.dst} is not what tint-mark.mjs produces from ${job.src}`)
      drifted++
    }
  } else {
    writeFileSync(path, png)
    console.log(`${job.src} → ${job.dst}  (chroma ${job.chroma}, hue ${job.hue}, ${png.length} bytes)`)
  }
}

if (check) {
  if (drifted) {
    console.error(`\nRun \`node scripts/tint-mark.mjs\` and commit the result.`)
    process.exit(1)
  }
  console.log(`Marks: ${JOBS.length} tinted discs match the greyscale artwork they are derived from.`)
}
