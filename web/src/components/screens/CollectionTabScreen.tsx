import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { TabNav, type TabNavItem } from '../ui/TabNav'
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

  const tabs: TabNavItem<CollectionTab>[] = [
    { id: 'cards',    label: 'Cards' },
    { id: 'augments', label: 'Augments' },
    { id: 'heroes',   label: 'Heroes' },
  ]

  return (
    <OverlayScreen title="COLLECTION" onBack={onBack}>
      <div className="player-screen">
        <TabNav
          items={tabs}
          activeId={tab}
          onSelect={setTab}
          ariaLabel="Collection sections"
          panelId="collection-panel"
        />
        <div className="tab-panel" id="collection-panel" role="tabpanel">
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
