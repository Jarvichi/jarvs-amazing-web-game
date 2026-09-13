import React from 'react'
import { Panel } from './Panel'

export type RunEndTone = 'gold' | 'ember' | 'arcane'
export type RunEndSize = 'md' | 'lg'

const PANEL_TONE = { gold: 'gold', ember: 'danger', arcane: 'arcane' } as const

interface Props {
  tone: RunEndTone
  /** `lg` widens the card for content denser than a stat block — a card
   *  grid or a leaderboard list. Defaults to the original `md` (360px). */
  size?: RunEndSize
  glow?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Shared "run outcome" card shape — glow + framed panel + entrance pop —
 * used by victory/defeat/summary/act-complete screens so the game speaks
 * one visual language for "your run just resolved" moments.
 */
export function RunEndCard({ tone, size = 'md', glow = true, className, children }: Props) {
  return (
    <>
      {glow && <div className={`run-end-glow run-end-glow--${tone}`} aria-hidden="true" />}
      <Panel
        elevation="floating"
        tone={PANEL_TONE[tone]}
        runeCorners
        className={['run-end-card', size === 'lg' && 'run-end-card--lg', className].filter(Boolean).join(' ')}
      >
        {children}
      </Panel>
    </>
  )
}
