import React, { useState } from 'react'
import { Card } from '../../game/types'
import { CollectionEntry, DeckEntry } from '../../game/collection'
import { CardDetailModal } from './CardDetailModal'

interface Options {
  collection?: CollectionEntry[]
  deckEntries?: DeckEntry[]
}

export function useCardDetail({ collection = [], deckEntries }: Options = {}) {
  const [detailCard, setDetailCard] = useState<Card | null>(null)

  const cardDetailNode = detailCard ? (
    <CardDetailModal
      card={detailCard}
      collection={collection}
      deckEntries={deckEntries}
      onClose={() => setDetailCard(null)}
    />
  ) : null

  return { openDetail: setDetailCard, cardDetailNode }
}
