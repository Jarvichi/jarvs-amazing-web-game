import React from 'react'

export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'
export type ButtonVariant = 'default' | 'gold' | 'danger' | 'ghost'

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
  ghost:   'action-btn--ghost',
}

interface Props {
  size?:           ButtonSize
  variant?:        ButtonVariant
  type?:           'button' | 'submit' | 'reset'
  onClick?:        (e: React.MouseEvent<HTMLButtonElement>) => void
  onPointerDown?:  (e: React.PointerEvent<HTMLButtonElement>) => void
  disabled?:       boolean
  title?:          string
  'aria-label'?:   string
  className?:      string
  style?:          React.CSSProperties
  children:        React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button({
  size    = 'md',
  variant = 'default',
  type    = 'button',
  onClick,
  onPointerDown,
  disabled,
  title,
  'aria-label': ariaLabel,
  className,
  style,
  children,
}, ref) {
  const classes = [
    'action-btn',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </button>
  )
})
