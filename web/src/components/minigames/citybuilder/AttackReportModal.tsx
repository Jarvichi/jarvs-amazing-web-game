import React from 'react'
import { AttackEvent, GOLD_SYMBOL } from '../../../game/cityBuilder'

export interface Props {
  attackReport:    AttackEvent
  hasDamagedForts: boolean
  onClose:         () => void
}

export function AttackReportModal({ attackReport, hasDamagedForts, onClose }: Props) {
  const count = attackReport.count ?? 1
  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className={`city-attack-report-header city-attack-report--${attackReport.outcome}`}>
          {count > 1 && `${count} RAIDS WHILE YOU WERE AWAY`}
          {count === 1 && attackReport.outcome === 'repelled' && '⚔ ATTACK REPELLED'}
          {count === 1 && attackReport.outcome === 'partial'  && '⚔ CITY RAIDED'}
          {count === 1 && attackReport.outcome === 'defeated' && '💀 CITY DEFEATED'}
        </div>
        <div className="city-attack-report-body">
          {count > 1 ? (
            <div className="city-attack-stat">
              Worst outcome: <strong>{attackReport.outcome}</strong> · {count} raids processed
            </div>
          ) : (
            <div className="city-attack-stat">
              Attacker power: <strong>{attackReport.power}</strong> vs your defence: <strong>{attackReport.defense}</strong>
            </div>
          )}
          {attackReport.outcome === 'repelled' && count === 1 && (
            <div className="city-attack-good">Your defences held! Minor wall damage only.</div>
          )}
          {attackReport.goldEarned > 0 && (
            <div className="city-attack-good">{GOLD_SYMBOL} +{attackReport.goldEarned.toLocaleString()} gold — enemy loot seized!</div>
          )}
          {attackReport.stolenGold > 0 && (
            <div className="city-attack-bad">{GOLD_SYMBOL} {attackReport.stolenGold.toLocaleString()} gold stolen</div>
          )}
          {attackReport.destroyedBuildings.length > 0 && (
            <div className="city-attack-bad">
              Buildings destroyed: {attackReport.destroyedBuildings.join(', ')}
            </div>
          )}
          {hasDamagedForts && (
            <div className="city-attack-warn">Fortifications damaged — residents are repairing.</div>
          )}
        </div>
        <button className="action-btn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
