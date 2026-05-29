import React, { ReactNode } from 'react'

export interface ToolbarLabelProps {
  children: ReactNode
  spaced?: boolean
  className?: string
}

export function ToolbarLabel({ children, spaced, className }: ToolbarLabelProps) {
  return (
    <span className={`u-mg-l-md u-mg-r-md filter-label${spaced ? ' filter-label--spaced' : ''} ${className}`}>
      {children}
    </span>
  )
}
