import React from 'react'
import { MinigameShell } from '../MinigameShell'
import { Button } from '../../ui/Button'

interface Props {
  jackpotWon: { tier: string; amount: number }
  onDismiss: () => void
}

export function JackpotWinScreen({ jackpotWon, onDismiss }: Props) {
  return (
    <MinigameShell title="FRUIT MACHINE" icon="🎰">
      <div className="fm-jackpot-win-overlay">
        <div className="fm-jackpot-win-tier">{jackpotWon.tier} JACKPOT!</div>
        <div className="fm-jackpot-win-amount">+{jackpotWon.amount} credits!</div>
        <Button variant="gold" onClick={onDismiss}>
          COLLECT
        </Button>
      </div>
    </MinigameShell>
  )
}
