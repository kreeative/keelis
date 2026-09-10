/** Theme: system (default) | light | dark. Persisted; applied via data-theme on <html>. */
export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'kaalis.theme'

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* ignore */
  }
}

export function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
