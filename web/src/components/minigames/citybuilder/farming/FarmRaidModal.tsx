import React from 'react'
import { FarmRaidEvent } from '../../../../game/farmingSim'
import { RESOURCE_ICONS, ResourceType } from '../../../../game/cityBuilder'
import { ModalBackdrop } from '../../../ui/ModalBackdrop'

export interface Props {
  raid:    FarmRaidEvent
  onClose: () => void
}

const OUTCOME_META: Record<FarmRaidEvent['outcome'], { icon: string; cls: string; label: string }> = {
  repelled: { icon: '🛡', cls: 'farm-raid--repelled', label: 'REPELLED' },
  partial:  { icon: '⚠',  cls: 'farm-raid--partial',  label: 'PARTIAL RAID' },
  defeated: { icon: '💀', cls: 'farm-raid--defeated',  label: 'OVERRUN' },
}

export function FarmRaidModal({ raid, onClose }: Props) {
  const meta = OUTCOME_META[raid.outcome]
  const stolenEntries = Object.entries(raid.stolenResources).filter(([, v]) => (v as number) > 0) as [ResourceType, number][]

  return (
    <ModalBackdrop onClose={onClose}>
      <div className={`farm-raid-modal ${meta.cls}`}>
        <div className="farm-raid-icon">{meta.icon}</div>
        <div className="farm-raid-outcome">{meta.label}</div>

        <div className="farm-raid-row">
          <span>Raid power</span><span>{raid.power}</span>
        </div>
        <div className="farm-raid-row">
          <span>Farm defence</span><span>{raid.defense}</span>
        </div>

        {stolenEntries.length > 0 && (
          <div className="farm-raid-stolen">
            <div className="farm-raid-stolen-title">Stolen resources</div>
            <div className="u-flex u-gap-3 u-wrap">
              {stolenEntries.map(([res, amt]) => (
                <span key={res} className="city-res-chip">
                  {RESOURCE_ICONS[res]} {Math.round(amt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {raid.destroyedPlots.length > 0 && (
          <div className="farm-raid-destroyed">
            <div className="farm-raid-destroyed-title">Destroyed buildings</div>
            {raid.destroyedPlots.map((name, i) => (
              <div key={i} className="farm-raid-destroyed-item">💥 {name}</div>
            ))}
          </div>
        )}

        {raid.outcome === 'repelled' && (
          <div className="farm-raid-success">No damage — your farmers held the line!</div>
        )}

        <button className="action-btn" onClick={onClose} style={{ marginTop: 12 }}>
          DISMISS
        </button>
      </div>
    </ModalBackdrop>
  )
}
