import React from 'react'

interface Props {
  mana: number
  maxMana: number
  manaAccum: number
}

/** Mana pips — one per max-mana point, the next one filling shows live
 *  regeneration progress instead of just popping full when it completes. */
export function ManaBar({ mana, maxMana, manaAccum }: Props) {
  const pips = Array.from({ length: maxMana }, (_, i) => {
    if (i < mana) return 'full'
    if (i === mana) return 'partial'
    return 'empty'
  })
  return (
    <div className="mana-bar u-flex u-items-c">
      {pips.map((pipState, i) => (
        <span key={i} className={`mana-pip mana-pip--${pipState}`}>
          {pipState === 'partial'
            ? <span className="mana-pip-fill" style={{ width: `${manaAccum * 100}%` }} />
            : null}
        </span>
      ))}
    </div>
  )
}
