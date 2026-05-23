import React from 'react';
import { ReactNode } from 'react';

export interface ToolbarButtonProps {
  onClick?: () => void
  active?: boolean
  disabled?: boolean

  label: string
  icon?: ReactNode
  locked?: boolean

  title?: string
  className?: string
  style?: React.CSSProperties
}

export function ToolbarButton({ onClick, active, disabled, label, icon, locked, title, className, style }: ToolbarButtonProps) {
  const cls = [
    'filter-btn',
    active && 'filter-btn--active',
    disabled && 'filter-btn--disabled',
    locked && 'filter-btn--locked',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} style={style}>
      {locked ? <div className="filter-btn-icon">🔒</div> : icon ? <div className="filter-btn-icon">{icon}</div> : null}
      <span>{label}</span>
    </button>
  )
}
