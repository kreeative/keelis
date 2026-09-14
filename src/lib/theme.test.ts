/**
 * The theme choice, and the browser's own bar.
 *
 * `index.html`'s two `theme-color` metas are gated on `prefers-color-scheme`, which answers
 * for the *system* and not for the toggle. Choosing dark on a light-set phone therefore left
 * a cream strip above a dark brown app — the exact seam those tags exist to remove — and it
 * did so for every explicit choice, in both directions.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, readTheme, resolvedTheme } from './theme'

const LIGHT = '#fcfaf4'
const DARK = '#21170d'

/** The head as the document ships it: charset first, then the two media-gated colours. */
function resetHead() {
  document.head.innerHTML = `
    <meta charset="UTF-8" />
    <meta name="theme-color" content="${LIGHT}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${DARK}" media="(prefers-color-scheme: dark)" />
  `
  delete document.documentElement.dataset.theme
  localStorage.clear()
}

/** What a user agent picks: the first `theme-color` in tree order whose media matches. */
function chosen(systemPrefersDark: boolean): string | undefined {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media')
    if (!media) return meta.getAttribute('content') ?? undefined
    const wantsDark = media.includes('dark')
    if (wantsDark === systemPrefersDark) return meta.getAttribute('content') ?? undefined
  }
  return undefined
}

beforeEach(resetHead)

describe('applyTheme', () => {
  it('marks the root so the CSS island applies', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('gives the browser bar the dark colour when dark is chosen on a light system', () => {
    applyTheme('dark')
    expect(chosen(false)).toBe(DARK)
  })

  it('gives the browser bar the light colour when light is chosen on a dark system', () => {
    applyTheme('light')
    expect(chosen(true)).toBe(LIGHT)
  })

  it('hands the bar back to the system when the choice is « système »', () => {
    applyTheme('dark')
    applyTheme('system')
    expect(chosen(false)).toBe(LIGHT)
    expect(chosen(true)).toBe(DARK)
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(2)
  })

  it('overrides rather than accumulating when the choice changes', () => {
    applyTheme('dark')
    applyTheme('light')
    applyTheme('dark')
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(3)
    expect(chosen(false)).toBe(DARK)
  })

  it('leaves <meta charset> first, where it has to stay', () => {
    applyTheme('dark')
    expect(document.head.querySelector('meta')?.getAttribute('charset')).toBe('UTF-8')
  })

  it('copies the colour out of the metas rather than carrying its own', () => {
    // If the hex were written here too, it would be the copy that goes stale.
    document.head.innerHTML = document.head.innerHTML.replace(DARK, '#010203')
    applyTheme('dark')
    expect(chosen(false)).toBe('#010203')
  })
})

describe('the stored choice', () => {
  it('round-trips through localStorage as a bare string', () => {
    /* Not JSON: three e2e harnesses stored '"light"' and matched nothing, so every walk
       fell back to « système » — which looked identical and meant the explicit path was
       never exercised. */
    applyTheme('dark')
    expect(localStorage.getItem('keewal.theme')).toBe('dark')
    expect(readTheme()).toBe('dark')
    applyTheme('system')
    expect(readTheme()).toBe('system')
  })

  it('resolves an explicit choice without asking the system', () => {
    expect(resolvedTheme('dark')).toBe('dark')
    expect(resolvedTheme('light')).toBe('light')
  })
})
