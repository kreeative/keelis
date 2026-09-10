import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastItem {
  id: number
  message: string
  tone?: 'default' | 'error'
}

interface ToastApi {
  toast: (message: string, tone?: ToastItem['tone']) => void
  current: ToastItem | null
  dismiss: () => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setCurrent(null)
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'default') => {
      if (timer.current) clearTimeout(timer.current)
      seq.current += 1
      setCurrent({ id: seq.current, message, tone })
      const duration = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toast-duration')) || 3000
      timer.current = setTimeout(() => setCurrent(null), duration)
    },
    [],
  )

  const value = useMemo(() => ({ toast, current, dismiss }), [toast, current, dismiss])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
