import React, { useMemo, useState } from 'react'
import { CardTile } from '../cards/CardTile'
import { getCardCatalog } from '../../game/cards'
import { SECRET_RARITIES } from '../../game/types'
import { Button } from '../ui/Button'

const ROUNDS = 8
const CHOICES_PER_ROUND = 3

function pickRoundOffer(): string[] {
  const pool = getCardCatalog().filter(c => !SECRET_RARITIES.has(c.rarity))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, CHOICES_PER_ROUND).map(c => c.name)
}

interface Props {
  onComplete: (pickedCardNames: string[]) => void
  onBack: () => void
}

export function CardDraftScreen({ onComplete, onBack }: Props) {
  const [round, setRound] = useState(0)
  const [picks, setPicks] = useState<string[]>([])
  const offer = useMemo(pickRoundOffer, [round])
  const catalog = useMemo(getCardCatalog, [])
  const cards = offer.map(name => catalog.find(c => c.name === name)).filter(Boolean) as ReturnType<typeof getCardCatalog>

  function handlePick(cardName: string) {
    const nextPicks = [...picks, cardName]
    if (round + 1 >= ROUNDS) {
      onComplete(nextPicks)
    } else {
      setPicks(nextPicks)
      setRound(round + 1)
    }
  }

  return (
    <div className="qb-screen">
      <div className="qb-header u-text-c">
        <div className="qb-title">🃏  CARD DRAFT</div>
        <div className="qb-subtitle">Pick 1 of 3 cards — round {round + 1}/{ROUNDS}</div>
      </div>

      <div className="u-flex u-gap-7 u-just-c u-wrap">
        {cards.map(card => (
          <CardTile key={card.id} card={card} canAfford={true} onClick={() => handlePick(card.name)} />
        ))}
      </div>

      {round === 0 && (
        <Button variant="danger" onClick={onBack}>← BACK</Button>
      )}
    </div>
  )
}
