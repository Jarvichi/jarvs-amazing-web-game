import React from 'react'
import { JACKPOT_TIERS } from './boardConfig'

interface Props {
  grandJackpot: number
}

export function JackpotTiers({ grandJackpot }: Props) {
  return (
    <div className="fm-jackpots u-flex u-gap-3 u-just-c">
      {JACKPOT_TIERS.map(t => (
        <div key={t.name} className={`fm-jackpot-tier${t.progressive ? ' fm-jackpot-tier--grand' : ''}`}>
          <div className="fm-jackpot-name">{t.name}</div>
          <div className="fm-jackpot-amount">{t.progressive ? grandJackpot : t.credits}</div>
        </div>
      ))}
    </div>
  )
}
