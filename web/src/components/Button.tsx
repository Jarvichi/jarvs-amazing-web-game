import React from 'react'

export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'
export type ButtonVariant = 'default' | 'gold' | 'danger'

const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: 'action-btn--xs',
  sm: 'action-btn--sm',
  md: '',
  lg: 'action-btn--large',
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  gold:    'action-btn--gold',
  danger:  'action-btn--danger',
}

interface Props {
  size?:      ButtonSize
  variant?:   ButtonVariant
  onClick?:   () => void
  disabled?:  boolean
  title?:     string
  className?: string
  style?:     React.CSSProperties
  children:   React.ReactNode
}

export function Button({
  size    = 'md',
  variant = 'default',
  onClick,
  disabled,
  title,
  className,
  style,
  children,
}: Props) {
  const classes = [
    'action-btn',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {children}
    </button>
  )
}
