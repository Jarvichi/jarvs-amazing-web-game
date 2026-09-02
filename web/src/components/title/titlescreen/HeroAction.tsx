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
 *  weight so a first-time viewer can identify the primary action instantly.
 *
 *  Locked is NOT an HTML `disabled` button — a disabled button swallows the
 *  click entirely, so a locked tap produced no feedback of any kind (#2271).
 *  It stays clickable (onClick tells the player what's gating it) but reads
 *  as locked: a neutral panel tone instead of gold, and a dimmed label. */
export function HeroAction({ label, hint, locked, onClick }: Props) {
  return (
    <button
      type="button"
      className={`title-hero-btn${locked ? ' title-hero-btn--locked' : ''}`}
      onClick={onClick}
      aria-disabled={locked}
      title={hint}
    >
      <Panel elevation="floating" tone={locked ? 'neutral' : 'gold'} runeCorners className="title-hero-panel">
        <Icon name={locked ? 'lock' : 'sword'} size={28} />
        <span className="title-hero-label">{label}</span>
      </Panel>
    </button>
  )
}
