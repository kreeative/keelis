#!/usr/bin/env node
/**
 * Enforces the Kaalis acceptance criteria that can be checked statically:
 *  - no hard-coded colours outside tokens.css
 *  - no box-shadow outside the Sheet component (and the tokens file)
 *  - no gradients
 *  - no font-size below 12px (except the 11px nav label token)
 *  - no emoji in source
 *  - no foreign font families (Inter, Roboto)
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
const allowedColourFiles = [TOKENS]

function check(file) {
  const rel = relative(ROOT, file)
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (emoji.test(line)) violations.push(`${where}: emoji found`)
    if (/gradient\(/.test(line)) violations.push(`${where}: gradient`)
    if (/\b(Inter|Roboto)\b/.test(line) && /font/.test(line)) violations.push(`${where}: foreign font family`)
    if (file.endsWith('.css')) {
      if (!allowedColourFiles.includes(file) && colourLiteral.test(line) && !/currentColor|transparent|inherit/.test(line)) violations.push(`${where}: hard-coded colour → use a token`)
      if (/box-shadow\s*:/.test(line) && !/var\(--(sheet-shadow|focus-ring(-offset|-neg)?)\)/.test(line) && !/box-shadow\s*:\s*none/.test(line) && file !== TOKENS) violations.push(`${where}: box-shadow outside tokens (only --sheet-shadow / --focus-ring allowed)`)
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

walk(ROOT)
if (violations.length) {
  console.error(`Design check failed (${violations.length}):\n` + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
} else {
  console.log('Design check passed: no hard-coded colours, shadows, gradients, emoji or sub-12px text.')
}
