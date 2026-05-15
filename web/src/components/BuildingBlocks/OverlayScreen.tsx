import React from 'react'

interface Props {
  title: string
  onBack: () => void
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function OverlayScreen({ title, onBack, right, children, className = 'overlay-screen' }: Props) {
  return (
    <div className={className}>
      <div className="overlay-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <span className="overlay-title">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}
