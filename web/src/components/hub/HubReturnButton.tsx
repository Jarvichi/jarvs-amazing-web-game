import React from 'react'

interface Props {
  onClick: () => void
}

export function HubReturnButton({ onClick }: Props) {
  return (
    <button
      className="action-btn"
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        fontSize: 11,
        padding: '4px 10px',
        letterSpacing: '0.1em',
        opacity: 0.85,
      }}
    >
      COURTYARD
    </button>
  )
}
