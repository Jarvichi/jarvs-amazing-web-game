import React from 'react'
import { Card } from '../../../game/types'
import { AnimatedSpriteImg } from '../../ui/SpriteImg'

interface Props {
  card: Card
  owned: number
  inDeck: number
}

export function CardArtPanel({ card, owned, inDeck }: Props) {
  return (
    <div className="cdm-card-col u-col u-items-c u-gap-3">
      <AnimatedSpriteImg
        name={card.name}
        frameCount={3}
        fps={2}
        className="commander-sprite"
      />
      <div className="cdm-owned">×{owned} owned{inDeck > 0 ? ` · ×${inDeck} in deck` : ''}</div>
    </div>
  )
}
