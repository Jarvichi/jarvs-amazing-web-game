import React from 'react'
import type { QuestView } from '../../../game/hub/questBoard'
import { GroupHeading } from './GroupHeading'
import { ActionCard } from './ActionCard'
import { ListRow } from './ListRow'
import { SatchelEmpty } from './SatchelSheet'
import { QuestReadyCard, QuestProgressRow } from './QuestRows'
import type { SatchelSectionId } from './types'

export interface TodayPet {
  name: string
  /** One line on what the pet wants — treats left today, and so on. */
  note: string
}

export interface TodayTribute {
  amount: number
  available: boolean
  onCollect: () => void
}

interface Props {
  townName: string
  /** Quests whose receiver is standing in this town — finishable right now. */
  readyHere: QuestView[]
  inProgress: QuestView[]
  /** Finished, but the receiver is in another town. */
  readyElsewhere: QuestView[]
  tribute: TodayTribute
  pet: TodayPet | null
  /** Codex completion, 0–100. */
  codexPct: number
  onShowOnMap?: (npcId: string) => void
  onOpenSection: (id: SatchelSectionId) => void
  /** Opens the pet sheet, where naming and accessories live. */
  onOpenPet: () => void
  /** Whether an available Chronicle chapter hasn't been read yet. */
  chronicleUnread: boolean
  /** Opens the Fracture Chronicle screen. */
  onOpenChronicle: () => void
}

/**
 * The dashboard — the screen the old menu had no equivalent of.
 *
 * It reads no new state: quests, bounties, tribute, the pet and Codex progress
 * all already existed, filed in whichever tab owned them. What's new is the
 * sort — what can be acted on from where the player is standing comes first,
 * and what's waiting in another town is kept separate rather than mixed in.
 */
export function TodaySection({
  townName, readyHere, inProgress, readyElsewhere, tribute, pet, codexPct,
  onShowOnMap, onOpenSection, onOpenPet, chronicleUnread, onOpenChronicle,
}: Props) {
  const tributeReady = tribute.available && tribute.amount > 0
  const nothingToDo = readyHere.length === 0 && !tributeReady && !chronicleUnread
    && inProgress.length === 0 && readyElsewhere.length === 0

  return (
    <>
      {(readyHere.length > 0 || tributeReady || chronicleUnread) && (
        <>
          <GroupHeading tone="gold" count={readyHere.length + (tributeReady ? 1 : 0) + (chronicleUnread ? 1 : 0)}>
            Do this now
          </GroupHeading>
          {readyHere.map(view => (
            <QuestReadyCard key={view.id} view={view} onShowOnMap={onShowOnMap} />
          ))}
          {tributeReady && (
            <ActionCard
              title="Tribute is waiting"
              detail={`+${tribute.amount.toLocaleString()} 💎 from ${townName} · today only`}
              actionLabel="COLLECT"
              onAction={tribute.onCollect}
            />
          )}
          {chronicleUnread && (
            <ActionCard
              title="A new Chronicle chapter has surfaced"
              detail="The Chronicler has something to tell you."
              actionLabel="READ"
              onAction={onOpenChronicle}
            />
          )}
        </>
      )}

      {nothingToDo && (
        <SatchelEmpty>
          Nothing needs you right now. Talk to the townsfolk, or check the bounty board.
        </SatchelEmpty>
      )}

      {inProgress.length > 0 && (
        <>
          <GroupHeading count={inProgress.length}>In progress</GroupHeading>
          {inProgress.map(view => (
            <QuestProgressRow key={view.id} view={view} onShowOnMap={onShowOnMap} />
          ))}
        </>
      )}

      {readyElsewhere.length > 0 && (
        <>
          <GroupHeading count={readyElsewhere.length}>Waiting in another town</GroupHeading>
          {readyElsewhere.map(view => (
            <QuestReadyCard key={view.id} view={view} onShowOnMap={onShowOnMap} />
          ))}
        </>
      )}

      <GroupHeading>Around you</GroupHeading>
      {pet && (
        <ListRow icon="🐾" title={pet.name} subtitle={pet.note} value="›" onClick={onOpenPet} />
      )}
      <ListRow
        icon="🎒"
        title="Satchel"
        subtitle="What you're carrying"
        value="›"
        onClick={() => onOpenSection('satchel')}
      />
      <ListRow
        icon="🏘"
        title={townName}
        subtitle="Who's here, your standing, upgrades"
        value="›"
        onClick={() => onOpenSection('town')}
      />
      <ListRow
        icon="📖"
        title="Codex"
        subtitle={`${codexPct}% of this town discovered`}
        value="›"
        onClick={() => onOpenSection('codex')}
      />
    </>
  )
}
