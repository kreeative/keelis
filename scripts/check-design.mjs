#!/usr/bin/env node
/**
 * Enforces the Keewal Meere design system statically:
 *  - no hard-coded colours outside tokens.css
 *  - elevation only through the layered --elev-* / --sheet-shadow / focus-ring tokens
 *    (a hand-rolled single-blur shadow is the thing this catches)
 *  - no gradients at all, and no backdrop-filter: surfaces are plain fills
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
/* **A gradient may be written in the token layer, and nowhere else.**

   This forbade them outright, and the outright version was itself a reversal: they had been
   allowed in the ground layers — the ambient fields and the aurora wash — and in
   `--glass-sheen`, the diagonal highlight across the top-left corner of every surface. The
   owner asked for plain colours, because that sheen implies a light source the screen does
   not have, and then later asked for « des dégradés ». The later instruction is the one in
   force.

   What survives is the part that was doing the work. The failure mode both times was never
   « a gradient exists »; it was a look coming back **one component at a time**, each file
   individually defensible and the sum of them not. A gradient in `tokens.css` is a decision
   somebody made once, in a block with the reasoning beside it, that can be undone in one
   edit. A `linear-gradient(...)` typed into a component is the other thing, and that is what
   this now catches.

   `backdrop-filter` does not come back with them, and that is not an oversight: it was
   removed because the surfaces are opaque, so there is nothing behind a card to blur. A
   value-fall on a fill does not change that — it costs a paint, not a composited layer. */
const allowedGradientFiles = [TOKENS]
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
    /* No dropdowns. The owner asked for none anywhere, and a `<select>` is the one control
       in the app that cannot be themed, cannot show what an option costs or takes, and on a
       phone opens the OS's own wheel over the form. `Picker` replaced all five. */
    /* Backtick spans come out first: a line *about* `<select>` — and this file is full of
       them — is prose, not a dropdown. Without this the rule fired on its own rationale. */
    if (/<select[\s>]/.test(line.replace(/`[^`]*`/g, ''))) violations.push(`${where}: <select> — use Picker; a native dropdown cannot be themed and hides the form behind an OS wheel`)
    if (/gradient\(/.test(line) && !allowedGradientFiles.includes(file)) violations.push(`${where}: gradient written outside the token layer — add a --grad-* token and use var(--grad-…)`)
    if (file.endsWith('.css')) {
      if (!allowedColourFiles.includes(file) && colourLiteral.test(line) && !/currentColor|transparent|inherit/.test(line)) violations.push(`${where}: hard-coded colour → use a token`)
      if (/box-shadow\s*:/.test(line) && !SHADOW_TOKENS.test(line) && !/box-shadow\s*:\s*none/.test(line) && file !== TOKENS) violations.push(`${where}: hand-rolled box-shadow — use the layered --elev-* tokens`)
      if (/backdrop-filter\s*:/.test(line)) violations.push(`${where}: backdrop-filter — the surfaces are opaque, so a blur costs a layer and shows nothing`)
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
const ACCENT_TOKENS = /--(grad-)?(cta|cta-hover|accent|accent-text|accent-soft|aurora-\d)\b/
const CHROMA_MAX_ACCENT = 0.14
const CHROMA_MAX_SURFACE = 0.05

{
  const src = readFileSync(TOKENS, 'utf8')
  src.split('\n').forEach((line, i) => {
    const where = `styles/tokens.css:${i + 1}`
    const sanctionedHue = /--[a-z-]*(pos|neg|aurora-\d)\s*:/.test(line)
    /* **Every colour on the line, not the first one.** This read `line.match`, which is one
       match — fine while a token was a single colour, and a hole the moment a gradient token
       exists: `--grad-card` carries three stops, and only the first was ever checked, so a
       foreign hue or a runaway chroma could ride in on stop two of a line whose stop one was
       impeccable. The whole point of a band this narrow is that nothing slips through it. */
    const colours = [...line.matchAll(/oklch\(\s*[\d.]+\s+([\d.]+)\s+([\d.]+)/g)]
    if (!sanctionedHue) {
      const budget = ACCENT_TOKENS.test(line) ? CHROMA_MAX_ACCENT : CHROMA_MAX_SURFACE
      for (const m of colours) {
        const chroma = Number(m[1])
        const hue = Number(m[2])
        if (chroma > 0 && (hue < HUE_MIN || hue > HUE_MAX)) {
          violations.push(`${where}: hue ${hue} is outside the warm band ${HUE_MIN}–${HUE_MAX} — the palette is one family`)
        }
        if (chroma > budget) {
          violations.push(`${where}: chroma ${chroma} over the ${budget} budget for this role — only the accent ramp is saturated`)
        }
      }
    }
    const m = colours[0]
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
  console.log('Design check passed: one warm family, every gradient and colour from the token layer, no blur or dropdown anywhere, elevation from the tokens; no emoji or sub-12px text.')
}
