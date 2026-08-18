import React, { useEffect, useRef } from 'react'

interface Props {
  label: string
  activeSuffix?: string
  isActive: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

/** One filter/sort/group trigger + its dropdown popup — the shared shell
 *  CollectionScreen and DeckBuilder both compose instead of each hand-rolling
 *  their own trigger button, outside-click-to-close effect, and popup panel
 *  (#2178: previously three near-identical implementations). The set of
 *  options inside the popup is still screen-specific (children). */
export function FilterPopup({ label, activeSuffix, isActive, open, onToggle, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  return (
    <div className="filter-popup-wrap" ref={ref}>
      <button
        className={`filter-btn${isActive ? ' filter-btn--active' : ''}`}
        onClick={onToggle}
      >
        {label}{activeSuffix}
      </button>
      {open && (
        <div className="filter-popup">
          {children}
          {footer}
        </div>
      )}
    </div>
  )
}
