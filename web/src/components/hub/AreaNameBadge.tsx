import React from 'react'

interface Props {
  name: string | null
}

export function AreaNameBadge({ name }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 20,
        pointerEvents: 'none',
        opacity: name ? 1 : 0,
        transition: 'opacity 0.35s ease',
        textAlign: 'right',
      }}
    >
      <div style={{
        fontSize: 11,
        letterSpacing: '0.15em',
        color: 'rgba(200,220,200,0.6)',
        textTransform: 'uppercase',
        marginBottom: 2,
      }}>
        area
      </div>
      <div style={{
        fontSize: 16,
        letterSpacing: '0.08em',
        color: '#d4ead4',
        textShadow: '0 0 8px rgba(100,200,100,0.6)',
        textTransform: 'uppercase',
      }}>
        {name ?? ''}
      </div>
    </div>
  )
}
