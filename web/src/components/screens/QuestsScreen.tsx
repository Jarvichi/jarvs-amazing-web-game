import React, { useMemo } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getQuestStatuses, QuestChainStatus } from '../../game/quests'
import { getCardCatalog } from '../../game/cards'

interface Props {
  onBack: () => void
  embedded?: boolean
}

function QuestChainCard({ status }: { status: QuestChainStatus }) {
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
          ? <>🏆 {def.targetCard} has been added to your collection.</>
          : <>🏆 Completing all steps guarantees: <strong>{def.targetCard}</strong></>}
      </div>

      <div className="quest-steps">
        {def.steps.map((step, i) => {
          const target = step.condition.type === 'defeat_boss' ? 1 : step.condition.count
          const progress = stepProgress[i]
          const done = progress >= target
          const locked = !completed && i > activeStep
          return (
            <div key={i} className={`quest-step${done ? ' quest-step--done' : ''}${locked ? ' quest-step--locked' : ''}`}>
              <span className="quest-step-status">{done ? '✓' : locked ? '🔒' : '▸'}</span>
              <span className="quest-step-label">{step.label}</span>
              {!locked && target > 1 && (
                <span className="quest-step-progress">[{progress}/{target}]</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function QuestsScreen({ onBack, embedded }: Props) {
  const statuses = useMemo(() => getQuestStatuses(), [])
  const earned = statuses.filter(s => s.completed).length

  const content = (
    <div className="quests-screen">
      <div className="quests-blurb">
        Multi-step hunts for cards that cannot be won by luck. Steps complete in
        order, and progress carries across every run and battle mode.
        {' '}({earned}/{statuses.length} earned)
      </div>
      {statuses.map(s => <QuestChainCard key={s.def.id} status={s} />)}
    </div>
  )

  if (embedded) return content
  return (
    <OverlayScreen title="EXOTIC QUESTS" subtitle={`${earned}/${statuses.length} cards earned`} onBack={onBack}>
      {content}
    </OverlayScreen>
  )
}
