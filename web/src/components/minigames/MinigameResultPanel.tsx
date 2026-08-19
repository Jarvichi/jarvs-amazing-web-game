import React from 'react'
import { Panel } from '../ui/Panel'

interface Props {
  headline: React.ReactNode
  ctaLabel: string
  onCta: () => void
  tone?: 'gold' | 'ember'
  children?: React.ReactNode
}

/**
 * Shared minigame result screen — formalizes the "minigame-result-panel"
 * convention nearly every arcade game already reaches for by hand onto a
 * real Panel, so "you won" reads the same everywhere (matching Tower
 * Defence's EndScreen, the cleanest existing precedent).
 */
export function MinigameResultPanel({ headline, ctaLabel, onCta, tone = 'gold', children }: Props) {
  return (
    <Panel
      elevation="floating"
      tone={tone === 'gold' ? 'gold' : 'danger'}
      runeCorners
      className="minigame-result-panel u-col u-items-c u-gap-5"
    >
      <div className="minigame-result-headline">{headline}</div>
      {children}
      <button
        className={`action-btn action-btn--large action-btn--${tone === 'gold' ? 'gold' : 'danger'}`}
        onClick={onCta}
      >
        {ctaLabel}
      </button>
    </Panel>
  )
}
