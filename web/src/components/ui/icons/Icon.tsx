import React from 'react'
import type { IconName } from './IconSprite'

interface Props {
  name: IconName
  size?: number
  className?: string
  style?: React.CSSProperties
  /** Set when the icon is the only content of an interactive control — feeds a11y (#2182). */
  'aria-label'?: string
}

/**
 * Renders one icon from the sprite sheet mounted by <IconSprite /> (see
 * IconSprite.tsx). Uses currentColor by default, so it themes with
 * whatever CSS `color` the surrounding text has — no colour prop needed.
 */
export function Icon({ name, size = 20, className, style, 'aria-label': ariaLabel }: Props) {
  const classes = ['icon', className].filter(Boolean).join(' ')
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      style={{ display: 'inline-block', flexShrink: 0, fill: 'currentColor', ...style }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <use href={`#icon-${name}`} />
    </svg>
  )
}
