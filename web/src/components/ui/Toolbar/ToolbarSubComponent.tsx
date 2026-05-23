import React from 'react';
import { ReactNode } from 'react';

export interface ToolbarSubComponentProps {
  onClick?:   () => void
  active?:    boolean
  disabled?:  boolean

  title?:     string
  className?: string
  style?:     React.CSSProperties
  children:   ReactNode
}

export function ToolbarSubComponent({ onClick, active, disabled, title, className, style, children }: ToolbarSubComponentProps) {
  const cls = ['filter-btn', active && 'filter-btn--active', className].filter(Boolean).join(' ');
    
return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} style={style}>
      {children} 
    </button>
  )
}