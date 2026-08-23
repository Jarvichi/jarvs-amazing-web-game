import React from 'react'
import { rewardSummary, type QuestTarget, type QuestView } from '../../../game/hub/questBoard'
import { ActionCard } from './ActionCard'
import { ListRow } from './ListRow'
import { EntityChip } from './EntityChip'

interface TargetProps {
  target: QuestTarget
  onShowOnMap?: (npcId: string) => void
}

/** Where the quest wants you next — the person, plus the town they're in when
 *  that isn't the town you're standing in. */
export function TargetChips({ target, onShowOnMap }: TargetProps) {
  return (
    <>
      <EntityChip
        label={target.name}
        tone={target.here ? 'default' : 'away'}
        onClick={onShowOnMap && target.here ? () => onShowOnMap(target.npcId) : undefined}
        title={target.here ? 'Show on the minimap' : `In ${target.townName}`}
      />
      {!target.here && <EntityChip label={target.townName} icon="🧭" tone="away" />}
    </>
  )
}

interface QuestProps {
  view: QuestView
  onShowOnMap?: (npcId: string) => void
}

/** A quest with every objective satisfied. Gold when it can be handed in from
 *  where the player is standing, quiet when the receiver is in another town. */
export function QuestReadyCard({ view, onShowOnMap }: QuestProps) {
  const here = view.target?.here === true
  const reward = rewardSummary(view.reward)

  return (
    <ActionCard
      tone={here ? 'gold' : 'quiet'}
      title={`${view.title} — ready`}
      detail={
        view.target
          ? <>Hand in to <TargetChips target={view.target} onShowOnMap={onShowOnMap} />{reward && ` · ${reward}`}</>
          : reward
      }
      actionLabel={onShowOnMap && here ? 'SHOW ON MAP' : undefined}
      onAction={onShowOnMap && here ? () => onShowOnMap(view.target!.npcId) : undefined}
    />
  )
}

interface ProgressProps extends QuestProps {
  /** Trailing controls, e.g. the abandon button in the Quests section. */
  actions?: React.ReactNode
}

/** A quest still being worked on, as one row with a progress bar. */
export function QuestProgressRow({ view, onShowOnMap, actions }: ProgressProps) {
  const next = view.objectives.find(o => !o.done)

  return (
    <ListRow
      icon={view.kind === 'bounty' ? '🎯' : '📜'}
      title={view.title}
      subtitle={
        <>
          {next?.label ?? view.hint}
          {view.target && !view.target.here && <> · <TargetChips target={view.target} onShowOnMap={onShowOnMap} /></>}
        </>
      }
      value={next ? `${next.current}/${next.required}` : undefined}
      progress={{ current: view.current, required: view.required, tone: view.kind === 'bounty' ? 'gold' : 'green' }}
      actions={actions}
    />
  )
}
