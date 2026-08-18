import React from 'react'

export type PanelElevation = 'flat' | 'raised' | 'floating'
export type PanelTone = 'neutral' | 'gold' | 'danger' | 'arcane'

interface Props {
  elevation?: PanelElevation
  tone?: PanelTone
  runeCorners?: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Panel({
  elevation = 'raised',
  tone = 'neutral',
  runeCorners = false,
  className,
  style,
  children,
}: Props) {
  const classes = [
    'panel',
    `panel--${elevation}`,
    tone !== 'neutral' ? `panel--${tone}` : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} style={style}>
      {runeCorners && (
        <>
          <span className="panel-corner panel-corner--tl" aria-hidden="true" />
          <span className="panel-corner panel-corner--tr" aria-hidden="true" />
          <span className="panel-corner panel-corner--bl" aria-hidden="true" />
          <span className="panel-corner panel-corner--br" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  )
}
