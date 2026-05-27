import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { hasUnclaimedAchievements } from '../../game/achievements'
import { PlayerStatsScreen } from './PlayerStatsScreen'
import { CharacterScreen } from './CharacterScreen'
import { AchievementsScreen } from './AchievementsScreen'
import { InventoryScreen } from './InventoryScreen'

type PlayerTab = 'stats' | 'character' | 'achievements' | 'inventory'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
}

export function PlayerScreen({ crystals, onCrystalsChanged, onBack }: Props) {
  const [tab, setTab] = useState<PlayerTab>('stats')
  const achievementAlert = hasUnclaimedAchievements()

  const tabs: { id: PlayerTab; label: string; badge?: boolean }[] = [
    { id: 'stats',        label: 'Stats' },
    { id: 'character',    label: 'Character' },
    { id: 'achievements', label: 'Achievements', badge: achievementAlert },
    { id: 'inventory',    label: 'Inventory' },
  ]

  return (
    <OverlayScreen title="PLAYER" onBack={onBack}>
      <div className="player-screen">
        <div className="player-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`player-tab${tab === t.id ? ' player-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge && <span className="player-tab-badge" />}
            </button>
          ))}
        </div>
        <div className="player-tab-content">
          {tab === 'stats'        && <PlayerStatsScreen onBack={() => setTab('stats')} embedded />}
          {tab === 'character'    && <CharacterScreen onDone={() => setTab('stats')} embedded />}
          {tab === 'achievements' && <AchievementsScreen onBack={() => setTab('stats')} onCrystalsChanged={onCrystalsChanged} embedded />}
          {tab === 'inventory'    && <InventoryScreen onBack={() => setTab('stats')} onCrystalsChanged={onCrystalsChanged} embedded />}
        </div>
      </div>
    </OverlayScreen>
  )
}
