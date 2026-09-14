/**
 * The palette, checked where a comment cannot check itself.
 *
 * `scripts/check-design.mjs` polices the band and the chroma budget. These are the two
 * things it cannot see: that the dark theme is written twice and the copies agree, and that
 * the `theme-color` in `index.html` is still the colour it claims to be measured from.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
/* Comments out first: they explain the tokens at length, and a sentence about
   `--canvas-bg: var(--surface)` parses as a declaration if you let it. */
const CSS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8')

/** The declarations inside one `{ … }` block, normalised for comparison. */
function declarations(css: string, startAfter: string): Map<string, string> {
  const from = css.indexOf(startAfter)
  if (from < 0) throw new Error(`block not found: ${startAfter}`)
  const body = css.slice(from + startAfter.length)
  const out = new Map<string, string>()
  for (const m of body.slice(0, body.indexOf('\n}')).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.replace(/\s+/g, ' ').trim())
  }
  return out
}

/**
 * oklch → sRGB hex, so a token and a `theme-color` can be compared as the browser sees them
 * rather than as two strings that happen to sit near each other in a file.
 */
function oklchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return (
    '#' +
    lin
      .map((c) => {
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
        return Math.min(255, Math.max(0, Math.round(v * 255)))
          .toString(16)
          .padStart(2, '0')
      })
      .join('')
  )
}

function oklchOf(value: string): [number, number, number] {
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) throw new Error(`not an oklch value: ${value}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

describe('the dark theme is written twice and the copies agree', () => {
  /* `:root[data-theme="dark"]` serves the explicit toggle and the `prefers-color-scheme`
     block serves the system setting. CSS cannot put a media query inside a selector list,
     so the palette is duplicated — which means every change has to land in both, and a
     change that lands in one is invisible: the app looks right until somebody who never
     touched the toggle opens it. */
  const toggled = declarations(CSS, ':root[data-theme="dark"] {')
  const system = declarations(CSS, ':root:not([data-theme="light"]) {')

  it('declares the same tokens in both', () => {
    expect([...system.keys()].sort()).toEqual([...toggled.keys()].sort())
  })

  it('gives every token the same value in both', () => {
    const differing = [...toggled.entries()].filter(([k, v]) => system.get(k) !== v).map(([k, v]) => `${k}: ${v} vs ${system.get(k)}`)
    expect(differing).toEqual([])
  })
})

describe('index.html’s theme-color is the colour it says it is', () => {
  /* The browser paints its own bar with this, and the top of the page is the home canvas —
     so a value left behind from a previous palette is a strip of the old theme sitting
     above the new one, which is the exact seam these tags exist to remove. */
  const themeColors = [...HTML.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)"/g)]

  it('declares one for each scheme', () => {
    expect(themeColors.map((m) => m[2])).toEqual(['light', 'dark'])
  })

  it('matches --surface in light and --card-surface in dark', () => {
    const light = declarations(CSS, ':root {\n  color-scheme: light;')
    const expected: Record<string, string> = {
      // In light the canvas resolves to the page's own surface; in dark it is the card's.
      light: oklchToHex(...oklchOf(light.get('--surface')!)),
      dark: oklchToHex(...oklchOf(light.get('--card-surface')!)),
    }
    for (const m of themeColors) expect(m[1], `theme-color for ${m[2]}`).toBe(expected[m[2]!])
  })
})
