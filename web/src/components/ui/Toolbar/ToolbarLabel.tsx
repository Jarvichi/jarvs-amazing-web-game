import React, { ReactNode } from 'react'

export interface ToolbarLabelProps {
  children: ReactNode
  spaced?: boolean
}

export function ToolbarLabel({ children, spaced }: ToolbarLabelProps) {
  return (
    <span className={`u-mg-l-md u-mg-r-md filter-label${spaced ? ' filter-label--spaced' : ''}`}>
      {children}
    </span>
  )
}
