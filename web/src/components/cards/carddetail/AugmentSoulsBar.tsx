import React from 'react'

interface Props {
  souls: number
  upgradeError?: string | null
}

/** Shared between CardDetailModal's Augments tab and CardAugmentScreen. */
export function AugmentSoulsBar({ souls, upgradeError }: Props) {
  return (
    <div className="cas-souls-bar">
      <span className="cas-souls-label">Augment Souls:</span>
      <span className="cas-souls-value">{souls.toLocaleString()} 👻</span>
      {upgradeError && <span className="cas-souls-error">{upgradeError}</span>}
    </div>
  )
}
