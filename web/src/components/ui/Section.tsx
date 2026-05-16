import React from 'react'

interface Props {
  title: string
  children: React.ReactNode
  bordered?: boolean
  headerRight?: React.ReactNode
}

export function Section({ title, children, bordered = false, headerRight }: Props) {
  return (
    <div className={`section u-col u-gap-3${bordered ? ' section--bordered' : ''}`}>
      <div className="section-title" style={headerRight ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : undefined}>
        <span>{title}</span>
        {headerRight}
      </div>
      {children}
    </div>
  )
}
