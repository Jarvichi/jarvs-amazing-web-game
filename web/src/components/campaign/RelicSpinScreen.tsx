import React, { useState, useEffect } from 'react'
import { Button } from '../BuildingBlocks/Button'

interface Props {
  relicName:   string
  relicIcon:   string
  breaks:      boolean
  brokenName?: string
  brokenIcon?: string
  brokenDesc?: string
  onContinue:  () => void
}

export function RelicSpinScreen({
  relicName, relicIcon, breaks, brokenName, brokenIcon, brokenDesc, onContinue,
}: Props) {
  const [phase, setPhase] = useState<'spinning' | 'revealed'>('spinning')

  useEffect(() => {
    const t = setTimeout(() => setPhase('revealed'), 2000)
    return () => clearTimeout(t)
  }, [])

  const displayIcon = phase === 'revealed' && breaks ? (brokenIcon ?? '🪨') : relicIcon
  const displayName = phase === 'revealed' && breaks ? (brokenName ?? `Cracked ${relicName}`) : relicName

  const iconWrapClass = [
    'rss-icon-wrap',
    phase === 'spinning'            ? 'rss-icon--spinning'  :
    breaks                          ? 'rss-icon--broken'    :
                                      'rss-icon--survived',
  ].join(' ')

  return (
    <div className="relic-spin-screen">
      <div className="rss-bg-glow" />

      <div className="rss-header">RELIC CHECK</div>
      <div className="rss-divider">══════════════════════</div>

      <div className={iconWrapClass}>
        <div className="rss-icon">{displayIcon}</div>
      </div>

      <div className="rss-relic-name">{displayName}</div>

      <div className="rss-subtitle">
        {phase === 'spinning'
          ? 'The fates deliberate\u2026'
          : breaks
          ? 'The relic could not endure.'
          : 'The relic holds firm.'}
      </div>

      {phase === 'revealed' && (
        <>
          <div className={`rss-verdict ${breaks ? 'rss-verdict--break' : 'rss-verdict--survive'}`}>
            {breaks ? '⚠ RELIC SHATTERS' : '✓ RELIC SURVIVES'}
          </div>

          <div className="rss-flavour">
            {breaks
              ? (brokenDesc ?? `The ${relicName} could not withstand the strain.`)
              : `The ${relicName} endures. It lives to fight another day.`}
          </div>

          <Button size="lg" onClick={onContinue}>CONTINUE</Button>
        </>
      )}
    </div>
  )
}
