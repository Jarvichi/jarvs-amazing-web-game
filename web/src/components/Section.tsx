import React from 'react'

interface Props {
  title: string
  children: React.ReactNode
  bordered?: boolean
}

export function Section({ title, children, bordered = false }: Props) {
  return (
    <div className={`section${bordered ? ' section--bordered' : ''}`}>
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}
