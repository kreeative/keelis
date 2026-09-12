import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, readTheme, resolvedTheme, type ThemeChoice } from '@/lib/theme'
import { setFormatLocale, type Locale } from '@/lib/format'
import { readJson, writeJson } from '@/lib/storage'

interface Settings {
  theme: ThemeChoice
  resolved: 'light' | 'dark'
  setTheme: (t: ThemeChoice) => void
  locale: Locale
  setLocale: (l: Locale) => void
  /** Balances masked */
  hidden: boolean
  toggleHidden: () => void
  reducedMotion: boolean
}

const SettingsContext = createContext<Settings | null>(null)

const LOCALES: readonly Locale[] = ['fr-SN', 'en-NG']

/**
 * A stored locale has to be *validated*, not just read back.
 *
 * The locale set moved from fr-CA / en-CA to fr-SN / en-NG, and anyone who used the app
 * before that still has the old string in their browser. Handing it straight to Intl is
 * silently wrong rather than broken: fr-CA renders XOF as "XOF" where fr-SN renders it
 * "F CFA", so the app looks Canadian to exactly the people who have used it longest.
 */
function readLocale(): Locale {
  const stored = readJson<string>('keelis.locale', 'fr-SN')
  return (LOCALES as readonly string[]).includes(stored) ? (stored as Locale) : 'fr-SN'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => readTheme())
  const [systemDark, setSystemDark] = useState(() => resolvedTheme('system') === 'dark')
  const [locale, setLocaleState] = useState<Locale>(() => readLocale())
  const [hidden, setHidden] = useState(() => readJson<boolean>('keelis.hidden', false))
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onMq = () => setSystemDark(!!mq?.matches)
    const onRm = () => setReducedMotion(!!rm?.matches)
    mq?.addEventListener?.('change', onMq)
    rm?.addEventListener?.('change', onRm)
    return () => {
      mq?.removeEventListener?.('change', onMq)
      rm?.removeEventListener?.('change', onRm)
    }
  }, [])

  useEffect(() => {
    setFormatLocale(locale)
    document.documentElement.lang = locale
    writeJson('keelis.locale', locale)
  }, [locale])

  const setTheme = useCallback((t: ThemeChoice) => setThemeState(t), [])
  const setLocale = useCallback((l: Locale) => setLocaleState(l), [])
  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      writeJson('keelis.hidden', !h)
      return !h
    })
  }, [])

  const value = useMemo<Settings>(
    () => ({ theme, resolved: theme === 'system' ? (systemDark ? 'dark' : 'light') : theme, setTheme, locale, setLocale, hidden, toggleHidden, reducedMotion }),
    [theme, systemDark, setTheme, locale, setLocale, hidden, toggleHidden, reducedMotion],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
