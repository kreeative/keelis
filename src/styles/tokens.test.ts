/**
 * The palette, checked where a comment cannot check itself.
 *
 * `scripts/check-design.mjs` polices the band and the chroma budget. These are the things it
 * cannot see: that the dark theme is written twice and the copies agree, that the
 * `theme-color` in `index.html` is still the colour it claims to be measured from, and that
 * `DESIGN.md`'s contrast table still describes the tokens rather than a palette they used to
 * have.
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

/** WCAG 2.x relative luminance, from an oklch triple. */
function luminance(L: number, C: number, H: number): number {
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
  ].map((c) => Math.min(1, Math.max(0, c)))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

function ratio(a: string, b: string): number {
  const la = luminance(...oklchOf(a))
  const lb = luminance(...oklchOf(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('DESIGN.md’s contrast table describes the tokens it is about', () => {
  /* The table was computed by hand when the palette changed, which makes every row a claim
     with nothing keeping it true: move `--accent-soft` by 0.04 to clear a real audit failure
     — as this palette needed — and two rows quietly become fiction. A design document that
     is confidently wrong about contrast is worse than one that says nothing, because it is
     the thing somebody checks *instead of* measuring. */
  const light = declarations(CSS, ':root {\n  color-scheme: light;')
  const dark = declarations(CSS, ':root[data-theme="dark"] {')
  const rows = [...readFileSync(join(ROOT, 'DESIGN.md'), 'utf8').matchAll(/^\|\s*`(--[\w-]+)` sur `(--[\w-]+)`\s*\|\s*([\d,]+):1\s*\|\s*([\d,]+):1\s*\|/gm)]

  it('has a table to check', () => {
    expect(rows.length).toBeGreaterThanOrEqual(8)
  })

  it.each([
    ['clair', light, 3],
    ['sombre', dark, 4],
  ] as const)('matches the computed ratios in %s', (_scheme, tokens, column) => {
    const wrong: string[] = []
    for (const row of rows) {
      const [fg, bg] = [row[1]!, row[2]!]
      // The dark block redeclares only what changes; anything else is inherited from light.
      const resolve = (name: string) => tokens.get(name) ?? light.get(name)!
      const actual = ratio(resolve(fg), resolve(bg))
      const claimed = Number(row[column]!.replace(',', '.'))
      // A tenth either way: the table is rounded to one decimal.
      if (Math.abs(actual - claimed) > 0.1) wrong.push(`${fg} on ${bg}: table says ${claimed}, tokens give ${actual.toFixed(1)}`)
    }
    expect(wrong).toEqual([])
  })
})

describe('the focus ring can actually be seen, on every surface it can land on', () => {
  /* **`pnpm e2e:keyboard` proves a ring *exists*; nothing proved it was visible.** The walk
     looks for an outline or a box-shadow and is right to — a ring may sit on a wrapper, and
     `Field` draws it there on purpose — but a ring the same value as what is behind it passes
     that check exactly as well as a good one. The contrast audit cannot cover it either: it
     measures text against its background, and a ring is a border.

     WCAG 2.2 SC 1.4.11 asks 3:1 for a focus indicator. Measured when this was written:
     light 7.21 on the page, 6.41 on the sheet ground, 7.34 on a keypad key; dark 13.03,
     14.33 and 8.43. There is plenty of room — which is exactly why it is worth pinning, since
     the failure mode is somebody nudging `--accent` for a *text* audit (it is a bronze in
     light and the gold in dark for precisely that reason) and taking the ring with it.

     `--card-surface` is deliberately absent: it is the **virtual payment card**, which is
     always dark in both themes, and `VirtualCard.tsx` renders no button, link or `tabIndex`
     — nothing focusable can land on it. Touching the card turns it over, but that is a
     pointer shortcut on a `div` that takes no focus; the keyboard's way in is « Afficher les
     numéros » under the card, on the page's own ground. Its pair measures 2.34:1 in light
     and asserting on it would fail the build over a combination that cannot occur. (It is
     also not the `Card` component's fill, which is the `--surface` family. The name
     misleads.) */
  const light = declarations(CSS, ':root {\n  color-scheme: light;')
  const dark = declarations(CSS, ':root[data-theme="dark"] {')

  /**
   * Every **opaque** fill a focusable control actually sits on.
   *
   * `--fill-subtle` is deliberately not here, and leaving it in is how this test first failed:
   * it is `oklch(0.22 0.026 68 / 0.08)` — an eight-percent ink wash in light and a fourteen-
   * percent paper wash in dark — so it is not a ground at all. What sits behind a chip or a
   * hovered row is that wash *over* whatever it is painted on, and those are already in this
   * list. Comparing the ring to the undiluted ink gave 2.29:1 and 1.21:1, two numbers for a
   * colour that never reaches a screen.
   */
  const GROUNDS = ['--surface', '--sheet-ground', '--key-face']

  /* A translucent token in that list computes a ratio against a colour nobody sees, and it
     does it silently — which is the failure this whole file exists to catch, one level up. */
  it.each([
    ['clair', light],
    ['sombre', dark],
  ] as const)('compares against opaque grounds only, in %s', (_scheme, tokens) => {
    const value = (name: string) => tokens.get(name) ?? light.get(name)!
    expect(GROUNDS.filter((g) => value(g).includes('/'))).toEqual([])
  })

  it.each([
    ['clair', light],
    ['sombre', dark],
  ] as const)('holds 3:1 against each ground in %s', (scheme, tokens) => {
    // The dark block redeclares only what changes; anything else is inherited from light.
    const value = (name: string) => tokens.get(name) ?? light.get(name)!
    const accent = value('--accent')
    const failing = GROUNDS.filter((g) => ratio(accent, value(g)) < 3).map((g) => `${g} in ${scheme}: ${ratio(accent, value(g)).toFixed(2)}:1`)
    expect(failing).toEqual([])
  })
})

describe('the ink on a gradient holds at both ends of it', () => {
  /* **A gradient is two backgrounds, and a contrast figure taken on the average is a figure
     taken on neither.** `--on-cta` was measured once against the flat `--cta`; the moment
     that fill became a value-fall, the darkest stop is what the text at the bottom of the
     button actually sits on, and that stop is the one nothing was checking. The button label
     is `--fw-bold` at `--fs-body`, so it is ordinary text at a 4.5:1 floor, not large text.

     Every stop of every gradient is read, not just the first — the same hole the design
     check had, where `--grad-card`'s three stops were one `line.match` and stops two and
     three were never looked at at all. */
  const light = declarations(CSS, ':root {\n  color-scheme: light;')
  const dark = declarations(CSS, ':root[data-theme="dark"] {')

  /** Every oklch stop in a gradient declaration, in order. */
  function stops(value: string): string[] {
    return [...value.matchAll(/oklch\([^)]+\)/g)].map((m) => m[0])
  }

  it.each([
    ['clair', light],
    ['sombre', dark],
  ] as const)('keeps --on-cta at 4.5:1 across --grad-cta and its hover in %s', (scheme, tokens) => {
    const value = (name: string) => tokens.get(name) ?? light.get(name)!
    const ink = value('--on-cta')
    const failing: string[] = []
    for (const grad of ['--grad-cta', '--grad-cta-hover']) {
      const ends = stops(value(grad))
      expect(ends.length, `${grad} should declare stops`).toBeGreaterThanOrEqual(2)
      for (const end of ends) if (ratio(ink, end) < 4.5) failing.push(`${grad} @ ${end} in ${scheme}: ${ratio(ink, end).toFixed(2)}:1`)
    }
    expect(failing).toEqual([])
  })

  /* The card is always dark in both themes, so it is declared once and checked once. Its ink
     is `--card-ink`, not `--on-cta`. */
  it('keeps --card-ink at 4.5:1 across every stop of --grad-card', () => {
    const ink = light.get('--card-ink')!
    const failing = stops(light.get('--grad-card')!)
      .filter((end) => ratio(ink, end) < 4.5)
      .map((end) => `--grad-card @ ${end}: ${ratio(ink, end).toFixed(2)}:1`)
    expect(failing).toEqual([])
  })

  /**
   * A gradient replaces a flat token, and it has to *be* that token — otherwise the palette
   * says one thing and the screen says another, and the flat value stays behind in the
   * places that still read it (`--cta` is still what a disabled button and the segmented
   * control's own pill resolve to).
   */
  it.each([
    ['clair', light],
    ['sombre', dark],
  ] as const)('centres each gradient on the flat token it replaces, in %s', (_scheme, tokens) => {
    const value = (name: string) => tokens.get(name) ?? light.get(name)!
    const drift: string[] = []
    for (const [grad, flat] of [
      ['--grad-cta', '--cta'],
      ['--grad-cta-hover', '--cta-hover'],
      ['--grad-key', '--key-face'],
    ] as const) {
      const ends = stops(value(grad)).map((s) => oklchOf(s)[0])
      const mid = (Math.min(...ends) + Math.max(...ends)) / 2
      const want = oklchOf(value(flat))[0]
      if (Math.abs(mid - want) > 0.006) drift.push(`${grad} midpoint ${mid.toFixed(3)} vs ${flat} ${want.toFixed(3)}`)
    }
    expect(drift).toEqual([])
  })
})
