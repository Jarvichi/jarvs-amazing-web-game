import React from 'react'
import { Button } from './Button'

interface Props {
  onClick:     () => void
  children:    React.ReactNode
  variant?:    'large' | 'default'
  disabled?:   boolean
  title?:      string
  badge?:      boolean
  extraClass?: string
}

export function TitleButton({ onClick, children, variant = 'default', disabled, title, badge, extraClass }: Props) {
  return (
    <Button
      size={variant === 'large' ? 'lg' : 'md'}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={['title-nav-btn', extraClass].filter(Boolean).join(' ')}
      style={badge ? { position: 'relative' } : undefined}
    >
      {children}
      {badge && <span className="title-badge">!</span>}
    </Button>
  )
}
