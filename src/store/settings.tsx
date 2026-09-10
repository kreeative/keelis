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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => readTheme())
  const [systemDark, setSystemDark] = useState(() => resolvedTheme('system') === 'dark')
  const [locale, setLocaleState] = useState<Locale>(() => readJson<Locale>('kaalis.locale', 'fr-CA'))
  const [hidden, setHidden] = useState(() => readJson<boolean>('kaalis.hidden', false))
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
    writeJson('kaalis.locale', locale)
  }, [locale])

  const setTheme = useCallback((t: ThemeChoice) => setThemeState(t), [])
  const setLocale = useCallback((l: Locale) => setLocaleState(l), [])
  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      writeJson('kaalis.hidden', !h)
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
