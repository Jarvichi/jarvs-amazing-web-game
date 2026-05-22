import React, { useState, useEffect, useRef, ReactNode } from 'react'

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar u-flex u-items-c u-just-l u-wrap">{children}</div>
}

export interface ToolbarButtonProps {
  onClick?:   () => void
  active?:    boolean
  disabled?:  boolean
  title?:     string
  className?: string
  style?:     React.CSSProperties
  children:   ReactNode
}

export function ToolbarButton({ onClick, active, disabled, title, className, style, children }: ToolbarButtonProps) {
  const cls = ['filter-btn', active && 'filter-btn--active', className].filter(Boolean).join(' ')
  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} style={style}>
      {children}
    </button>
  )
}

export interface ToolbarDropdownProps {
  label?:     ReactNode
  disabled?: boolean
  children:  ReactNode
}

export function ToolbarDropdown({ label, disabled, children }: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button
        className={`filter-btn${open ? ' filter-btn--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
      >
        {label} ▾
      </button>
      {open && (
        <div className="toolbar-dropdown-panel" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
