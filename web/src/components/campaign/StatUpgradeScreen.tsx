import React, { useState } from 'react'
import { type StatUpgradeType } from '../../game/playerStats'
import { NodeScreen } from './node/NodeScreen'
import { ChoiceCard } from './node/ChoiceCard'
import { Button } from '../ui/Button'
import { Icon } from '../ui/icons/Icon'

interface Props {
  onSelect: (stat: StatUpgradeType) => void
}

interface UpgradeOption {
  stat:  StatUpgradeType
  icon:  React.ReactNode
  name:  string
  desc:  string
}

const OPTIONS: UpgradeOption[] = [
  {
    stat: 'maxHp',
    icon: <Icon name="heart" size={28} />,
    name: 'Max Health',
    desc: 'Increase your starting and maximum campaign HP by 10.',
  },
  {
    stat: 'maxMana',
    icon: <Icon name="mana" size={28} />,
    name: 'Max Mana',
    desc: 'Increase your maximum mana by 1, letting you play more powerful cards.',
  },
  {
    stat: 'maxDeckSize',
    icon: <Icon name="card" size={26} />,
    name: 'Deck Capacity',
    desc: 'Carry one additional card in your campaign deck.',
  },
  {
    stat: 'maxLives',
    icon: '⚡',
    name: 'Extra Life',
    desc: 'Start each campaign run with one additional life.',
  },
  {
    stat: 'manaRegenMs',
    icon: '⏩',
    name: 'Mana Flow',
    desc: 'Your mana regenerates 10% faster in every battle.',
  },
]

export function StatUpgradeScreen({ onSelect }: Props) {
  const [picked, setPicked] = useState<StatUpgradeType | null>(null)

  return (
    <NodeScreen
      title="PERMANENT UPGRADE"
      actions={
        <Button
          size="lg"
          className="relic-select-confirm"
          disabled={picked === null}
          onClick={() => picked && onSelect(picked)}
        >
          {picked
            ? `CLAIM ${OPTIONS.find(o => o.stat === picked)!.name.toUpperCase()} →`
            : 'SELECT AN UPGRADE'}
        </Button>
      }
    >
      <div className="relic-select-header u-text-c">
        <div className="relic-select-subtitle">
          Choose one upgrade to carry into every future campaign run.
        </div>
      </div>

      <div className="relic-select-grid u-col u-gap-5">
        {OPTIONS.map((opt, i) => (
          <ChoiceCard
            key={opt.stat}
            icon={opt.icon}
            name={opt.name}
            desc={opt.desc}
            chosen={picked === opt.stat}
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => setPicked(opt.stat)}
          />
        ))}
      </div>
    </NodeScreen>
  )
}
