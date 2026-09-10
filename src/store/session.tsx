/**
 * Session + app lock.
 * - status: loading → anonymous | authenticated
 * - lock: PIN required after the app has been hidden for a while, or after idle timeout
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '@/api'
import type { SecuritySettings, Session, User } from '@/api/types'
import { clearQueryCache } from './query'

type Status = 'loading' | 'anonymous' | 'authenticated'

interface SessionCtx {
  status: Status
  user: User | null
  security: SecuritySettings | null
  locked: boolean
  setSession: (s: Session) => void
  refreshUser: () => Promise<void>
  refreshSecurity: () => Promise<void>
  signOut: () => Promise<void>
  unlock: (pin: string) => Promise<boolean>
  lock: () => void
}

const Ctx = createContext<SessionCtx | null>(null)

/** How long the tab may stay hidden before we require the PIN again. */
const HIDDEN_LOCK_MS = 20_000

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [security, setSecurity] = useState<SecuritySettings | null>(null)
  const [locked, setLocked] = useState(false)
  const hiddenAt = useRef<number | null>(null)
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    let alive = true
    api.auth
      .getSession()
      .then((s) => {
        if (!alive) return
        if (s) {
          setUser(s.user)
          setStatus('authenticated')
          void api.profile.security().then((sec) => alive && setSecurity(sec)).catch(() => {})
        } else setStatus('anonymous')
      })
      .catch(() => alive && setStatus('anonymous'))
    return () => {
      alive = false
    }
  }, [])

  const setSession = useCallback((s: Session) => {
    setUser(s.user)
    setStatus('authenticated')
    setLocked(false)
    void api.profile.security().then(setSecurity).catch(() => {})
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await api.profile.me()
    setUser(u)
  }, [])

  const refreshSecurity = useCallback(async () => {
    setSecurity(await api.profile.security())
  }, [])

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    clearQueryCache()
    setUser(null)
    setSecurity(null)
    setLocked(false)
    setStatus('anonymous')
  }, [])

  const lock = useCallback(() => {
    if (status === 'authenticated') setLocked(true)
  }, [status])

  const unlock = useCallback(async (pin: string) => {
    const { ok } = await api.auth.verifyPin(pin)
    if (ok) {
      setLocked(false)
      lastActivity.current = Date.now()
    }
    return ok
  }, [])

  // Lock when returning from background after HIDDEN_LOCK_MS
  useEffect(() => {
    if (status !== 'authenticated') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > HIDDEN_LOCK_MS) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [status])

  // Idle timeout → lock
  useEffect(() => {
    if (status !== 'authenticated') return
    const timeoutMs = (security?.sessionTimeoutMinutes ?? 10) * 60_000
    const bump = () => {
      lastActivity.current = Date.now()
    }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const iv = setInterval(() => {
      if (Date.now() - lastActivity.current > timeoutMs) setLocked(true)
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(iv)
    }
  }, [status, security?.sessionTimeoutMinutes])

  const value = useMemo<SessionCtx>(
    () => ({ status, user, security, locked, setSession, refreshUser, refreshSecurity, signOut, unlock, lock }),
    [status, user, security, locked, setSession, refreshUser, refreshSecurity, signOut, unlock, lock],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
