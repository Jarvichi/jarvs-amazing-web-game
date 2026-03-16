import React from 'react'

interface Props {
  onClick: () => void
  children: React.ReactNode
  variant?: 'large' | 'default'
  disabled?: boolean
  title?: string
  badge?: boolean
  extraClass?: string
}

export function TitleButton({ onClick, children, variant = 'default', disabled, title, badge, extraClass }: Props) {
  const classes = [
    'action-btn',
    variant === 'large' ? 'action-btn--large' : '',
    'title-nav-btn',
    extraClass ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={badge ? { position: 'relative' } : undefined}
    >
      {children}
      {badge && <span className="title-badge">!</span>}
    </button>
  )
}
