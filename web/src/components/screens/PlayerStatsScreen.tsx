import React from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Panel } from '../ui/Panel'
import { ListRow } from '../ui/rows/ListRow'
import { loadPlayerStats } from '../../game/playerStats'
import { Icon } from '../ui/icons/Icon'

interface Props {
  onBack: () => void
  embedded?: boolean
}

export function PlayerStatsScreen({ onBack, embedded }: Props) {
  const s = loadPlayerStats()

  const rows: { label: string; icon: React.ReactNode; value: string; note: string }[] = [
    {
      label: 'Max Health',
      icon:  <Icon name="heart" size={18} />,
      value: `${s.maxHp} HP`,
      note:  s.maxHp > 50 ? `+${s.maxHp - 50} from upgrades` : 'Base',
    },
    {
      label: 'Max Mana',
      icon:  <Icon name="mana" size={18} />,
      value: `${s.maxMana}`,
      note:  s.maxMana > 5 ? `+${s.maxMana - 5} from upgrades` : 'Base',
    },
    {
      label: 'Deck Capacity',
      icon:  <Icon name="card" size={18} />,
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

  const content = (
    <>
      <div className="player-stats-intro">
        Permanent upgrades earned by completing campaigns.
      </div>
      <Panel elevation="raised">
        {rows.map(row => (
          <ListRow key={row.label} icon={row.icon} title={row.label} subtitle={row.note} value={row.value} />
        ))}
      </Panel>
    </>
  )

  if (embedded) return content
  return <OverlayScreen title="PLAYER STATS" onBack={onBack}>{content}</OverlayScreen>
}
