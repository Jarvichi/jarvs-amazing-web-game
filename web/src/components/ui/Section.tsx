import React from 'react'

interface Props {
  title: React.ReactNode
  children: React.ReactNode
  bordered?: boolean
  headerRight?: React.ReactNode
  className?: string
}

export function Section({ title, children, bordered = false, headerRight, className }: Props) {
  return (
    <div className={`section u-col u-gap-3${bordered ? ' section--bordered' : ''}${className ? ` ${className}` : ''}`}>
      <div className="section-title" style={headerRight ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : undefined}>
        <span>{title}</span>
        {headerRight}
      </div>
      {children}
    </div>
  )
}
