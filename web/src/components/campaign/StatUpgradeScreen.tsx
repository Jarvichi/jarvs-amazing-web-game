import React, { useState } from 'react'
import { type StatUpgradeType } from '../../game/playerStats'

interface Props {
  onSelect: (stat: StatUpgradeType) => void
}

interface UpgradeOption {
  stat:  StatUpgradeType
  icon:  string
  name:  string
  desc:  string
}

const OPTIONS: UpgradeOption[] = [
  {
    stat: 'maxHp',
    icon: '❤️',
    name: 'Max Health',
    desc: 'Increase your starting and maximum campaign HP by 10.',
  },
  {
    stat: 'maxMana',
    icon: '✨',
    name: 'Max Mana',
    desc: 'Increase your maximum mana by 1, letting you play more powerful cards.',
  },
  {
    stat: 'maxDeckSize',
    icon: '🃏',
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
    <div className="relic-select-screen">
      <div className="relic-select-header u-text-c">
        <div className="relic-select-title">PERMANENT UPGRADE</div>
        <div className="relic-select-subtitle">
          Choose one upgrade to carry into every future campaign run.
        </div>
      </div>

      <div className="relic-select-grid u-col u-gap-5">
        {OPTIONS.map(opt => (
          <button
            key={opt.stat}
            className={`relic-select-card${picked === opt.stat ? ' relic-select-card--chosen' : ''}`}
            onClick={() => setPicked(opt.stat)}
          >
            <div className="relic-select-icon">{opt.icon}</div>
            <div className="relic-select-name">{opt.name}</div>
            <div className="relic-select-desc">{opt.desc}</div>
          </button>
        ))}
      </div>

      <button
        className="action-btn action-btn--large relic-select-confirm"
        disabled={picked === null}
        onClick={() => picked && onSelect(picked)}
      >
        {picked
          ? `CLAIM ${OPTIONS.find(o => o.stat === picked)!.name.toUpperCase()} →`
          : 'SELECT AN UPGRADE'}
      </button>
    </div>
  )
}
