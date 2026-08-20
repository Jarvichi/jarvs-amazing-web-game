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
    // The track's width is driven by the pip count but capped in CSS, so the
    // meter stays compact at a 3-mana start and stops growing once maxMana is
    // high enough that pips have to share the space instead. Without the count
    // here CSS can only either fix the width (wasting space at low maxMana) or
    // let it shrink to nothing against the HP bar's flex: 1.
    <div className="mana-bar u-flex u-items-c" style={{ '--mana-pips': maxMana } as React.CSSProperties}>
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
