#!/usr/bin/env node
/**
 * Enforces the Keelis design system statically:
 *  - no hard-coded colours outside tokens.css
 *  - elevation only through the layered --elev-* / --sheet-shadow / focus-ring tokens
 *    (a hand-rolled single-blur shadow is the thing this catches)
 *  - gradients only in the token and base layers (the ambient ground)
 *  - blur only through --glass-blur, so every glass surface matches
 *  - the palette stays monochrome: every oklch token has chroma 0
 *  - no font-size below 12px
 *  - no emoji in source
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
const allowedColourFiles = [TOKENS, ASSET_ICONS]
const allowedGradientFiles = [TOKENS, BASE, AMBIENT]
const SHADOW_TOKENS = /var\(--(elev-1|elev-2|elev-2-hover|elev-3|sheet-shadow|focus-ring|focus-ring-offset|focus-ring-neg|surface)\)/

function check(file) {
  const rel = relative(ROOT, file)
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (emoji.test(line)) violations.push(`${where}: emoji found`)
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

// The palette is monochrome by decision: an oklch value with chroma > 0 reintroduces a hue.
{
  const src = readFileSync(TOKENS, 'utf8')
  src.split('\n').forEach((line, i) => {
    const m = line.match(/oklch\(\s*[\d.]+\s+([\d.]+)/)
    if (m && Number(m[1]) > 0) violations.push(`styles/tokens.css:${i + 1}: oklch chroma ${m[1]} — the palette is black-and-white only`)
    const rgb = line.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (rgb && !(rgb[1] === rgb[2] && rgb[2] === rgb[3])) violations.push(`styles/tokens.css:${i + 1}: rgb(${rgb[1]},${rgb[2]},${rgb[3]}) is not a neutral`)
  })
}

walk(ROOT)
if (violations.length) {
  console.error(`Design check failed (${violations.length}):\n` + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
} else {
  console.log('Design check passed: colours, elevation, blur and gradients all come from the token layer; no emoji or sub-12px text.')
}
