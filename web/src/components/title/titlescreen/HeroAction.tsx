import React from 'react'
import { Panel } from '../../ui/Panel'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  label: string
  hint?: string
  locked: boolean
  onClick: () => void
}

/** The screen's single hero CTA — Continue Run or Campaign, given full visual
 *  weight so a first-time viewer can identify the primary action instantly. */
export function HeroAction({ label, hint, locked, onClick }: Props) {
  return (
    <button
      type="button"
      className="title-hero-btn"
      onClick={onClick}
      disabled={locked}
      title={hint}
    >
      <Panel elevation="floating" tone="gold" runeCorners className="title-hero-panel">
        <Icon name={locked ? 'lock' : 'sword'} size={28} />
        <span className="title-hero-label">{label}</span>
      </Panel>
    </button>
  )
}
