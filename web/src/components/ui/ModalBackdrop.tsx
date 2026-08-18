import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import ReactDOM from 'react-dom'

// ── Shared modal stack ──────────────────────────────────────────────────────
// Tracks every currently-mounted ModalBackdrop by a unique id, topmost last.
// Nested modals (e.g. a confirm dialog opened from inside another modal) each
// get their own instance of this component; only the topmost one should react
// to Esc or trap Tab, so every instance subscribes to the stack via
// useSyncExternalStore (same pattern as SpriteImg.tsx's shared animation
// ticker) and re-renders when who's on top changes.
let modalSeq = 0
const modalStack: number[] = []
const stackSubs = new Set<() => void>()

function pushModal(id: number) {
  modalStack.push(id)
  stackSubs.forEach(fn => fn())
}
function popModal(id: number) {
  const i = modalStack.indexOf(id)
  if (i !== -1) modalStack.splice(i, 1)
  stackSubs.forEach(fn => fn())
}
function subscribeStack(fn: () => void) {
  stackSubs.add(fn)
  return () => { stackSubs.delete(fn) }
}
function getTopmost() {
  return modalStack[modalStack.length - 1]
}

// ── Reference-counted body scroll lock ──────────────────────────────────────
let lockCount = 0
let savedOverflow = ''
function lockScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
}
function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  onClose: () => void
  children: React.ReactNode
  /** Escape hatch — defaults to the named --z-modal token; only override for a
      documented reason (e.g. a modal that must sit above another modal). */
  zIndex?: number
  /** Set false for a modal that must not be dismissed with Escape. */
  closeOnEscape?: boolean
  /** Labels the dialog for screen readers (sets aria-label). */
  title?: string
}

export function ModalBackdrop({ onClose, children, zIndex, closeOnEscape = true, title }: Props) {
  const idRef = useRef<number>(0)
  if (idRef.current === 0) idRef.current = ++modalSeq
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const topmostId = useSyncExternalStore(subscribeStack, getTopmost)
  const isTopmost = topmostId === idRef.current

  useEffect(() => {
    const id = idRef.current
    pushModal(id)
    lockScroll()
    return () => {
      popModal(id)
      unlockScroll()
    }
  }, [])

  // Focus trap + Esc, active only while this instance is the topmost modal.
  useEffect(() => {
    if (!isTopmost) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    ;(focusables[0] ?? panel)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to whatever triggered this modal, but only once nothing
      // else (e.g. a still-open parent modal) already reclaimed it.
      if (document.activeElement === panel || panel?.contains(document.activeElement)) {
        previouslyFocused.current?.focus?.()
      }
    }
  }, [isTopmost, closeOnEscape, onClose])

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      style={zIndex !== undefined ? { zIndex } : undefined}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ outline: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
