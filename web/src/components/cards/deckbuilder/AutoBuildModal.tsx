import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'

export type AutoStrategy = 'aggro' | 'control' | 'balanced' | 'ranged'

export const AUTO_STRATEGIES: { id: AutoStrategy; name: string; desc: string }[] = [
  { id: 'aggro',    name: 'AGGRO',    desc: 'Flood the field with cheap, fast units. Speed is your weapon.' },
  { id: 'ranged',   name: 'RANGED',   desc: 'Archers and bypass units that ignore walls. Strike from safety.' },
  { id: 'control',  name: 'CONTROL',  desc: 'Walls, Farms, and structures to grind the enemy down slowly.' },
  { id: 'balanced', name: 'BALANCED', desc: 'A mix of everything — units, structures, and upgrades.' },
]

interface Props {
  onSelect: (strategy: AutoStrategy) => void
  onClose: () => void
}

export function AutoBuildModal({ onSelect, onClose }: Props) {
  return (
    <ModalBackdrop onClose={onClose} title="Auto Build">
      <div className="autobuild-panel">
        <div>
          <div className="autobuild-title">⚡ AUTO BUILD</div>
          <div className="autobuild-sub">
            Choose a strategy. Your owned cards will be arranged into the strongest possible deck for that style.
            Resting cards are excluded.
          </div>
        </div>
        <div className="autobuild-strategies u-col u-gap-4">
          {AUTO_STRATEGIES.map(s => (
            <button
              key={s.id}
              className="autobuild-strategy"
              onClick={() => onSelect(s.id)}
            >
              <span className="autobuild-strategy-name">{s.name}</span>
              <span className="autobuild-strategy-desc">{s.desc}</span>
            </button>
          ))}
        </div>
        <Button className="autobuild-cancel" onClick={onClose}>
          CANCEL
        </Button>
      </div>
    </ModalBackdrop>
  )
}
