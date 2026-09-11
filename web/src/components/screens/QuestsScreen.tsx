import React, { useMemo } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getQuestStatuses } from '../../game/quests'
import { QuestChainCard } from './player/QuestChainCard'

interface Props {
  onBack: () => void
  embedded?: boolean
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
