import React from 'react'
import { Button } from '../BuildingBlocks/Button'

interface Props {
  relicName:   string
  brokenName:  string
  brokenIcon:  string
  brokenDesc:  string
  onContinue:  () => void
}

export function RelicBreakModal({ relicName, brokenName, brokenIcon, brokenDesc, onContinue }: Props) {
  return (
    <div className="relic-break-modal">
      <div className="rbm-glow" />

      <div className="rbm-header">⚠ RELIC DAMAGED</div>
      <div className="rbm-divider">══════════════════════</div>

      <div className="rbm-relic">
        <div className="rbm-relic-icon">{brokenIcon}</div>
        <div className="rbm-relic-name">{brokenName}</div>
        <div className="rbm-relic-desc">{brokenDesc}</div>
      </div>

      <div className="rbm-flavour">
        The defeat took its toll. {relicName} could not withstand the strain.
      </div>

      <Button size="lg" onClick={onContinue}>CONTINUE</Button>
    </div>
  )
}
