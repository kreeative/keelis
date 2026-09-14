#!/usr/bin/env node
/**
 * Enforces the Keewal Meere design system statically:
 *  - no hard-coded colours outside tokens.css
 *  - elevation only through the layered --elev-* / --sheet-shadow / focus-ring tokens
 *    (a hand-rolled single-blur shadow is the thing this catches)
 *  - gradients only in the token and base layers (the ambient ground)
 *  - blur only through --glass-blur, so every glass surface matches
 *  - the palette stays in one warm family: every token's hue sits in the sanctioned band
 *  - no font-size below 12px
 *  - no emoji in source
 *  - numbers are formatted through src/lib/format.ts, never a bare Intl.NumberFormat
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../src/', import.meta.url).pathname
const TOKENS = join(ROOT, 'styles/tokens.css')
const violations = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(css|tsx|ts)$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) check(p)
  }
}

const emoji = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]/u
const colourLiteral = /(#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|teal|pink)\b(?=\s*[;,)]))/
const BASE = join(ROOT, 'styles/base.css')
// The one component whose whole job is to paint the ambient colour field.
const AMBIENT = join(ROOT, 'components/AmbientGround.module.css')
/* The asset marks are the one sanctioned exception: a token's logo is how someone finds
   Bitcoin in a list without reading, so it keeps its real colours. Nothing else may. */
const ASSET_ICONS = join(ROOT, 'components/AssetIcon.tsx')
/* The app carries one number punctuation app-wide — comma groups, point decimal — and it
   lives in `joinParts` inside this file. A bare `Intl.NumberFormat` anywhere else skips it
   and silently prints French typography instead: `Delta` did exactly that, and every
   percentage in the application read « 8,01 % » beside « 346,345 F CFA ». */
const FORMAT = join(ROOT, 'lib/format.ts')
const allowedColourFiles = [TOKENS, ASSET_ICONS]
// The aurora wash is a second ground layer — same category as AmbientGround: radial
// fields behind everything, no text on them, no control in them.
const AURORA = join(ROOT, 'features/home/AuroraGround.module.css')
const allowedGradientFiles = [TOKENS, BASE, AMBIENT, AURORA]
const SHADOW_TOKENS = /var\(--(elev-1|elev-2|elev-2-hover|elev-3|elev-item|glass-rim|sheet-shadow|focus-ring|focus-ring-offset|focus-ring-neg|surface)\)/

function check(file) {
  const rel = relative(ROOT, file)
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (emoji.test(line)) violations.push(`${where}: emoji found`)
    if (/new Intl\.NumberFormat/.test(line) && file !== FORMAT) violations.push(`${where}: bare Intl.NumberFormat — format numbers through src/lib/format.ts, or the app's punctuation drifts`)
    if (/gradient\(/.test(line) && !allowedGradientFiles.includes(file)) violations.push(`${where}: gradient outside the token/base layer`)
    if (file.endsWith('.css')) {
      if (!allowedColourFiles.includes(file) && colourLiteral.test(line) && !/currentColor|transparent|inherit/.test(line)) violations.push(`${where}: hard-coded colour → use a token`)
      if (/box-shadow\s*:/.test(line) && !SHADOW_TOKENS.test(line) && !/box-shadow\s*:\s*none/.test(line) && file !== TOKENS) violations.push(`${where}: hand-rolled box-shadow — use the layered --elev-* tokens`)
      if (/backdrop-filter\s*:/.test(line) && !/var\(--glass-blur\)/.test(line) && !/backdrop-filter\s*:\s*(none|blur\(2px\))/.test(line) && !allowedGradientFiles.includes(file)) violations.push(`${where}: backdrop-filter outside --glass-blur`)
      const fs = line.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/)
      if (fs && Number(fs[1]) < 12 && file !== TOKENS) violations.push(`${where}: font-size ${fs[1]}px < 12px`)
      const min = line.match(/(min-height|height|min-width|width)\s*:\s*(\d+)px/)
      if (min && /\.(btn|button|tap|control)/.test(lines[Math.max(0, i - 5)] ?? '') && Number(min[2]) < 44 && !/handle|icon|avatar|dot|line|bar|spark/.test(line)) violations.push(`${where}: control smaller than 44px`)
    } else {
      // TSX/TS: colour literals in style props / SVG attributes
      if (/(fill|stroke|color|background)\s*[:=]\s*["'`]?(#[0-9a-fA-F]{3,8}|rgb|hsl|oklch)/.test(line) && !allowedColourFiles.includes(file)) violations.push(`${where}: hard-coded colour in TSX → use a token`)
      const fs = line.match(/fontSize\s*:\s*['"]?(\d+)px/)
      if (fs && Number(fs[1]) < 12) violations.push(`${where}: fontSize ${fs[1]}px < 12px`)
    }
  })
}

/**
 * The palette is one warm family, and this keeps it that way.
 *
 * It used to be monochrome — every token `oklch(L 0 0)` — and this check simply forbade
 * chroma. The owner replaced that decision with the brown-and-gold reference, so the rule
 * it enforces changes with it, but the *reason* for having a rule does not: a palette
 * nothing guards drifts one plausible colour at a time until it is a swatch collection.
 *
 * What holds now is the band. Sampling the reference, every surface, every piece of ink and
 * the accent itself sit between hue 62 and 97 — deep brown through to butter gold, one
 * family lit differently. So a token may carry hue, and it must carry *that* hue.
 *
 * Chroma is bounded by role rather than fixed, because the reference is emphatic about the
 * difference: the surfaces are nearly neutral (0.02–0.04) and only the accent is saturated
 * (~0.09). A surface that creeps up to the accent's chroma is how a restrained palette turns
 * into a brown one.
 *
 * The exceptions are the same three as before. --pos / --neg, because direction is the one
 * meaning people read by colour before they read anything, and green and red cannot be
 * warm. The asset marks (exempted by file above), because a logo is how a token is
 * recognised. And --aurora-*, the home page's wash — decorative, behind nothing but white
 * space, never under text or a control.
 */
const HUE_MIN = 55
const HUE_MAX = 105
/* The accent ramp is allowed to be saturated; everything else is a near-neutral that merely
   leans warm. Matched on the token's own name, so the budget is a property of the role. */
const ACCENT_TOKENS = /--(cta|cta-hover|accent|accent-text|accent-soft|aurora-\d)\b/
const CHROMA_MAX_ACCENT = 0.14
const CHROMA_MAX_SURFACE = 0.05

{
  const src = readFileSync(TOKENS, 'utf8')
  src.split('\n').forEach((line, i) => {
    const where = `styles/tokens.css:${i + 1}`
    const sanctionedHue = /--[a-z-]*(pos|neg|aurora-\d)\s*:/.test(line)
    const m = line.match(/oklch\(\s*[\d.]+\s+([\d.]+)\s+([\d.]+)/)
    if (m && !sanctionedHue) {
      const chroma = Number(m[1])
      const hue = Number(m[2])
      if (chroma > 0 && (hue < HUE_MIN || hue > HUE_MAX)) {
        violations.push(`${where}: hue ${hue} is outside the warm band ${HUE_MIN}–${HUE_MAX} — the palette is one family`)
      }
      const budget = ACCENT_TOKENS.test(line) ? CHROMA_MAX_ACCENT : CHROMA_MAX_SURFACE
      if (chroma > budget) {
        violations.push(`${where}: chroma ${chroma} over the ${budget} budget for this role — only the accent ramp is saturated`)
      }
    }
    /* An `oklch(L C)` with no hue at all is a grey, and a grey in a warm palette reads as a
       dead patch beside everything around it. Chroma 0 is therefore only allowed where the
       value is a shadow or a scrim — something that is an absence of light rather than a
       surface. */
    if (m && Number(m[1]) === 0 && !/(shadow|backdrop|scrim)/.test(line)) {
      violations.push(`${where}: chroma 0 — a pure grey in a warm palette reads as a dead patch`)
    }
    /* rgb() in the token layer is glass, a rim highlight or a shadow. A highlight is the
       light source's own colour and a shadow is its absence, so both may be neutral; a
       *fill* may not, or the glass panes go grey over a brown ground. */
    const rgb = line.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    const neutral = rgb && rgb[1] === rgb[2] && rgb[2] === rgb[3]
    if (neutral && /--glass-(bg|bg-strong|bg-soft|fallback)/.test(line)) {
      violations.push(`${where}: a neutral glass fill over a warm ground composites to grey`)
    }
  })
}

walk(ROOT)
if (violations.length) {
  console.error(`Design check failed (${violations.length}):\n` + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
} else {
  console.log('Design check passed: colours, elevation, blur and gradients all come from the token layer; no emoji or sub-12px text.')
}
