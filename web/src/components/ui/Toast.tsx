import React, { createContext, useCallback, useContext, useState } from 'react'
import { Icon } from './icons/Icon'
import type { IconName } from './icons/IconSprite'

export type ToastVariant = 'info' | 'success' | 'reward' | 'warning' | 'error'

interface ToastOptions {
  variant?: ToastVariant
  /** Overrides the variant's default auto-dismiss time, in ms. */
  duration?: number
  icon?: IconName
}

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  icon?: IconName
  remaining: number
  startedAt: number
  timeoutId: ReturnType<typeof setTimeout> | null
  removing: boolean
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  info: 3000,
  success: 3000,
  reward: 4000,
  warning: 4000,
  error: 5000,
}

// Oldest-out eviction once a screen fires more than this many at once.
const MAX_TOASTS = 4
// How long the exit animation runs before the item actually leaves the array.
const EXIT_MS = 200

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Throws outside a <ToastProvider> — mirrors the existing AppContext pattern. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

let toastSeq = 0

/**
 * Mounted once near the app root (App.tsx) so every screen can call
 * useToast() regardless of which route group it lives in. Renders its own
 * fixed-position stack — nothing else needs to render a host component.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const startExit = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, removing: true } : t)))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, EXIT_MS)
  }, [])

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    const variant = options.variant ?? 'info'
    const duration = options.duration ?? DEFAULT_DURATION[variant]
    const id = ++toastSeq
    const timeoutId = setTimeout(() => startExit(id), duration)
    const item: ToastItem = {
      id, message, variant, duration, icon: options.icon,
      remaining: duration, startedAt: Date.now(), timeoutId, removing: false,
    }
    setToasts(prev => {
      const next = [...prev, item]
      if (next.length > MAX_TOASTS) {
        const evicted = next.shift()
        if (evicted?.timeoutId) clearTimeout(evicted.timeoutId)
      }
      return next
    })
  }, [startExit])

  const pause = useCallback((id: number) => {
    setToasts(prev => prev.map(t => {
      if (t.id !== id || !t.timeoutId || t.removing) return t
      clearTimeout(t.timeoutId)
      const elapsed = Date.now() - t.startedAt
      return { ...t, timeoutId: null, remaining: Math.max(t.remaining - elapsed, 0) }
    }))
  }, [])

  const resume = useCallback((id: number) => {
    setToasts(prev => prev.map(t => {
      if (t.id !== id || t.timeoutId || t.removing) return t
      const timeoutId = setTimeout(() => startExit(id), t.remaining)
      return { ...t, timeoutId, startedAt: Date.now() }
    }))
  }, [startExit])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => {
      const t = prev.find(x => x.id === id)
      if (t?.timeoutId) clearTimeout(t.timeoutId)
      return prev
    })
    startExit(id)
  }, [startExit])

  const hasError = toasts.some(t => t.variant === 'error' && !t.removing)

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" aria-live={hasError ? 'assertive' : 'polite'} aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast--${t.variant}${t.removing ? ' toast--exiting' : ''}`}
            role="alert"
            onClick={() => dismiss(t.id)}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onTouchStart={() => pause(t.id)}
          >
            {t.icon && <Icon name={t.icon} size={16} className="toast-icon" />}
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
