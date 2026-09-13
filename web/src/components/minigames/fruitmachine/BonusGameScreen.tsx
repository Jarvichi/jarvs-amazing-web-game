import React from 'react'
import { MinigameShell } from '../MinigameShell'

export interface BonusTile {
  value: number
  collect: boolean
  revealed: boolean
}

interface Props {
  bonusTiles: BonusTile[]
  bonusPicksLeft: number
  bonusTotalWin: number
  onPickTile: (idx: number) => void
}

export function BonusGameScreen({ bonusTiles, bonusPicksLeft, bonusTotalWin, onPickTile }: Props) {
  return (
    <MinigameShell title="FRUIT MACHINE" icon="🎰">
      <div className="fm-bonus-game u-col u-items-c u-gap-5">
        <div className="fm-bonus-header">BONUS GAME — pick {bonusPicksLeft} {bonusPicksLeft === 1 ? 'prize' : 'prizes'}!</div>
        {bonusTotalWin > 0 && <div className="fm-bonus-running-total">Running total: +{bonusTotalWin} credits</div>}
        <div className="fm-bonus-tiles">
          {bonusTiles.map((tile, i) => (
            <button
              key={i}
              className={`fm-bonus-tile${tile.revealed ? ' fm-bonus-tile--revealed' : ''}`}
              onClick={() => onPickTile(i)}
              disabled={tile.revealed || bonusPicksLeft <= 0}
            >
              {tile.revealed
                ? (tile.collect ? '⛔ COLLECT' : `+${tile.value}`)
                : '?'}
            </button>
          ))}
        </div>
      </div>
    </MinigameShell>
  )
}
