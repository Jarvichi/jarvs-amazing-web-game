import React, { useMemo } from 'react'
import { QuestChainStatus } from '../../../game/quests'
import { getCardCatalog } from '../../../game/cards'
import { Icon } from '../../ui/icons/Icon'
import { ListRow } from '../../ui/rows/ListRow'

export function QuestChainCard({ status }: { status: QuestChainStatus }) {
  const { def, stepProgress, activeStep, completed } = status
  const targetRarity = useMemo(
    () => getCardCatalog().find(c => c.name === def.targetCard)?.rarity ?? 'legendary',
    [def.targetCard]
  )

  return (
    <div className={`quest-chain${completed ? ' quest-chain--completed' : ''}`}>
      <div className="quest-chain-header">
        <span className="quest-chain-icon">{def.icon}</span>
        <span className="quest-chain-name">{def.name}</span>
        <span className="quest-chain-reward">
          {completed ? '✓ EARNED' : `REWARD: ${targetRarity.toUpperCase()}`}
        </span>
      </div>
      <div className="quest-chain-intro">{def.intro}</div>
      <div className="quest-chain-target">
        {completed
          ? <><Icon name="trophy" size={13} /> {def.targetCard} has been added to your collection.</>
          : <><Icon name="trophy" size={13} /> Completing all steps guarantees: <strong>{def.targetCard}</strong></>}
      </div>

      <div className="quest-steps">
        {def.steps.map((step, i) => {
          const target = step.condition.type === 'defeat_boss' ? 1 : step.condition.count
          const progress = stepProgress[i]
          const done = progress >= target
          const locked = !completed && i > activeStep
          return (
            <ListRow
              key={i}
              tone={locked ? 'dim' : 'default'}
              icon={done ? '✓' : locked ? <Icon name="lock" size={11} /> : '▸'}
              title={done ? <s>{step.label}</s> : step.label}
              value={!locked && target > 1 ? `${progress}/${target}` : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
