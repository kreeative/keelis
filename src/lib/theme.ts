/**
 * Theme: light (default) | dark | system. Persisted; applied via `data-theme` on `<html>`.
 *
 * **The default is light, not the system's preference.** It used to be « système », and that
 * is the polite default for an app with no opinion — but this one has a reference, and the
 * owner asked for light. A phone set to dark would otherwise open the app in a theme its
 * owner never chose for it, and be the first thing most people ever see.
 *
 * Which forces a change in how the choice is stored: « système » used to be represented by
 * the key's *absence*, and absence now means light. So all three choices are written down,
 * and only a value that is none of them falls back.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'keewal.theme'
const DEFAULT: ThemeChoice = 'light'

function isChoice(v: string | null): v is ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'system'
}

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem('keelis.theme')
    if (isChoice(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT
}

/**
 * Keep the browser's own bar the colour of the top of the page.
 *
 * `index.html` carries two `theme-color` metas gated on `prefers-color-scheme`, which is
 * right for the first paint — before any of this has run — and wrong the moment somebody
 * uses the toggle: the media query still answers for the *system*, so choosing dark on a
 * light-set phone left a cream strip above a dark brown app, and choosing light on a
 * dark-set one left a near-black strip above a cream one. That strip is the seam those tags
 * exist to remove, and it was there for every explicit choice.
 *
 * The colour is copied out of the meta that already holds it rather than written again
 * here. A hex repeated in a second file is a hex that gets updated in one of them — and
 * those two are already pinned to `--surface` and `--card-surface` by a test.
 *
 * A user agent uses the first `theme-color` in tree order whose media matches, so the
 * override is inserted *before* them. Not at the head's start: `<meta charset>` has to stay
 * within the first bytes of the document.
 */
function syncThemeColor(choice: ThemeChoice) {
  const head = document.head
  if (!head) return
  const existing = head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-override]')
  if (choice === 'system') {
    existing?.remove()
    return
  }
  const source = head.querySelector<HTMLMetaElement>(`meta[name="theme-color"][media*="${choice}"]`)
  if (!source) return
  const meta = existing ?? document.createElement('meta')
  if (!existing) {
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('data-override', '')
    const first = head.querySelector('meta[name="theme-color"]')
    if (first) head.insertBefore(meta, first)
    else head.appendChild(meta)
  }
  meta.setAttribute('content', source.getAttribute('content') ?? '')
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  syncThemeColor(choice)
  try {
    // All three are written, « système » included: absence means the default, which is light.
    localStorage.setItem(KEY, choice)
  } catch {
    /* ignore */
  }
}

export function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
