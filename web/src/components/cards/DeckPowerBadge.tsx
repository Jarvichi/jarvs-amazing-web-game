import React, { useEffect, useRef, useState } from 'react'
import { DeckPowerBreakdown } from '../../game/deckPower'

interface Props {
  power: DeckPowerBreakdown
}

const TIER_NUMERAL = ['', 'I', 'II', 'III', 'IV', 'V']

/**
 * The deck's power rating, shown next to its card count.
 *
 * Purely a read-out — it changes nothing about the deck. Tapping it opens the
 * breakdown, because a bare number invites "why?" and the answer (which cards
 * are carrying the deck, in power per mana) is the interesting part.
 */
export function DeckPowerBadge({ power }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Same outside-click-to-close contract as FilterPopup, which this borrows
  // its panel styling from.
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (power.cardCount === 0) return null

  const tier = power.band.tier

  return (
    <div className="deck-power-wrap" ref={ref}>
      <button
        className={`deck-power-badge deck-power-badge--t${tier}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={`Deck power ${power.rating} — ${power.band.name}`}
      >
        <span className="deck-power-tier">{TIER_NUMERAL[tier]}</span>
        <span className="deck-power-name">{power.band.name}</span>
        <span className="deck-power-rating">{power.rating}</span>
      </button>

      {open && (
        <div className="filter-popup deck-power-popup">
          <div className="deck-power-popup-head">
            POWER {power.rating} · TIER {TIER_NUMERAL[tier]} {power.band.name}
          </div>
          <div className="filter-group-hint">
            Power per mana across {power.cardCount} cards in {power.uniqueCount} names.
            A deck of fairly-costed cards rates about 100.
          </div>
          <div className="deck-power-rows u-col u-gap-1">
            {power.topCards.map(c => (
              <div className="deck-power-row u-flex u-gap-3" key={c.name}>
                <span className="deck-power-row-name">{c.name}</span>
                <span className="deck-power-row-val">×{c.ratio.toFixed(1)}</span>
              </div>
            ))}
          </div>
          {power.consistency > 1.01 && (
            <div className="filter-group-hint">
              +{Math.round((power.consistency - 1) * 100)}% for draw consistency — few names,
              many copies.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
