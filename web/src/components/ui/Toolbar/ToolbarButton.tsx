import React from 'react';
import { ReactNode } from 'react';

export interface ToolbarButtonProps {
  onClick?: () => void
  active?: boolean
  disabled?: boolean

  label?: string
  icon?: ReactNode
  locked?: boolean

  size?: 'auto' | 'narrow' | 'wide' | 'fit'

  title?: string
  className?: string
  style?: React.CSSProperties
}

export function ToolbarButton({ onClick, active, disabled, label, icon, locked, size, title, className, style }: ToolbarButtonProps) {
  const cls = [
    'filter-btn',
    active && 'filter-btn--active',
    disabled && 'filter-btn--disabled',
    locked && 'filter-btn--locked',
    size === 'narrow' && 'filter-btn--narrow',
    size === 'wide'   && 'filter-btn--wide',
    size === 'fit'    && 'filter-btn--fit',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} style={style}>
      {locked ? <div className="filter-btn-icon">🔒</div> : icon ? <div className="filter-btn-icon">{icon}</div> : null}
      {label && <span>{label}</span>}
    </button>
  )
}
