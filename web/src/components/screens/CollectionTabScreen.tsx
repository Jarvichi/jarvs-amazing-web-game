import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { CollectionScreen } from './CollectionScreen'
import { AugmentCollectionScreen } from './AugmentCollectionScreen'
import { HeroCardsScreen } from './HeroCardsScreen'

type CollectionTab = 'cards' | 'augments' | 'heroes'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
  commanderName?: string | null
  onPromoteCommander?: (cardName: string) => void
}

export function CollectionTabScreen({ crystals, onCrystalsChanged, onBack, commanderName, onPromoteCommander }: Props) {
  const [tab, setTab] = useState<CollectionTab>('cards')

  const tabs: { id: CollectionTab; label: string }[] = [
    { id: 'cards',    label: 'Cards' },
    { id: 'augments', label: 'Augments' },
    { id: 'heroes',   label: 'Heroes' },
  ]

  return (
    <OverlayScreen title="COLLECTION" onBack={onBack}>
      <div className="player-screen">
        <div className="player-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`player-tab${tab === t.id ? ' player-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="player-tab-content">
          {tab === 'cards'    && (
            <CollectionScreen
              crystals={crystals}
              onCrystalsChanged={onCrystalsChanged}
              onBack={onBack}
              commanderName={commanderName}
              onPromoteCommander={onPromoteCommander}
              embedded
            />
          )}
          {tab === 'augments' && <AugmentCollectionScreen onBack={() => setTab('cards')} embedded />}
          {tab === 'heroes'   && <HeroCardsScreen onBack={() => setTab('cards')} embedded />}
        </div>
      </div>
    </OverlayScreen>
  )
}
