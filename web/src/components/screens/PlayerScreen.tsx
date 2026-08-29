import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { TabNav, type TabNavItem } from '../ui/TabNav'
import { hasUnclaimedAchievements } from '../../game/achievements'
import { PlayerStatsScreen } from './PlayerStatsScreen'
import { CharacterScreen } from './CharacterScreen'
import { AchievementsScreen } from './AchievementsScreen'
import { InventoryScreen } from './InventoryScreen'
import { QuestsScreen } from './QuestsScreen'

type PlayerTab = 'stats' | 'character' | 'achievements' | 'inventory' | 'quests'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
  onSignOut?: () => void
}

export function PlayerScreen({ crystals, onCrystalsChanged, onBack, onSignOut }: Props) {
  const [tab, setTab] = useState<PlayerTab>('stats')
  const achievementAlert = hasUnclaimedAchievements()

  const tabs: TabNavItem<PlayerTab>[] = [
    { id: 'character',    label: 'Character' },
    { id: 'inventory',    label: 'Inventory' },
    { id: 'quests',       label: 'Quests' },
    { id: 'achievements', label: 'Achievements', badge: achievementAlert },
    { id: 'stats',        label: 'Stats' },
  ]

  return (
    <OverlayScreen title="PLAYER" onBack={onBack}>
      <div className="player-screen">
        <TabNav
          items={tabs}
          activeId={tab}
          onSelect={setTab}
          ariaLabel="Player sections"
          panelId="player-panel"
        />
        <div className="tab-panel" id="player-panel" role="tabpanel">
          {tab === 'character'    && <CharacterScreen onDone={() => setTab('stats')} embedded />}
          {tab === 'quests'       && <QuestsScreen onBack={() => setTab('stats')} embedded />}
          {tab === 'achievements' && <AchievementsScreen onBack={() => setTab('stats')} onCrystalsChanged={onCrystalsChanged} embedded />}
          {tab === 'stats'        && <PlayerStatsScreen onBack={() => setTab('stats')} embedded />}
          {tab === 'inventory'    && <InventoryScreen onBack={() => setTab('stats')} onCrystalsChanged={onCrystalsChanged} embedded />}
        </div>
        {onSignOut && (
          <div className="player-signout-row">
            <button className="title-auth-btn" onClick={onSignOut}>🔓 SIGN OUT</button>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
