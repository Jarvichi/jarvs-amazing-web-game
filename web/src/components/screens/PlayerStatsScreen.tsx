import React from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { loadPlayerStats } from '../../game/playerStats'

interface Props {
  onBack: () => void
}

export function PlayerStatsScreen({ onBack }: Props) {
  const s = loadPlayerStats()

  const rows: { label: string; icon: string; value: string; note: string }[] = [
    {
      label: 'Max Health',
      icon:  '❤️',
      value: `${s.maxHp} HP`,
      note:  s.maxHp > 50 ? `+${s.maxHp - 50} from upgrades` : 'Base',
    },
    {
      label: 'Max Mana',
      icon:  '✨',
      value: `${s.maxMana}`,
      note:  s.maxMana > 5 ? `+${s.maxMana - 5} from upgrades` : 'Base',
    },
    {
      label: 'Deck Capacity',
      icon:  '🃏',
      value: `${s.maxDeckSize} cards`,
      note:  s.maxDeckSize > 30 ? `+${s.maxDeckSize - 30} from upgrades` : 'Base',
    },
    {
      label: 'Starting Lives',
      icon:  '⚡',
      value: `${s.maxLives}`,
      note:  s.maxLives > 3 ? `+${s.maxLives - 3} from upgrades` : 'Base',
    },
    {
      label: 'Mana Regen',
      icon:  '⏩',
      value: `1 mana / ${(s.manaRegenMs / 1000).toFixed(1)}s`,
      note:  s.manaRegenMs < 3000 ? `${Math.round((1 - s.manaRegenMs / 3000) * 100)}% faster` : 'Base',
    },
  ]

  return (
    <OverlayScreen title="PLAYER STATS" onBack={onBack}>
      <div style={{ padding: '8px 12px 4px', color: 'var(--game-text-color-dim)', fontSize: '11px', borderBottom: '1px solid var(--game-border)' }}>
        Permanent upgrades earned by completing campaigns.
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map(row => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              background: 'var(--game-bg-raised)',
              border: '1px solid var(--game-border)',
              borderRadius: '4px',
            }}
          >
            <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center' }}>{row.icon}</span>
            <span style={{ flex: 1, fontSize: '13px' }}>{row.label}</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{row.value}</span>
            <span style={{ fontSize: '10px', color: 'var(--game-text-color-dim)', minWidth: '80px', textAlign: 'right' }}>{row.note}</span>
          </div>
        ))}
      </div>
    </OverlayScreen>
  )
}
