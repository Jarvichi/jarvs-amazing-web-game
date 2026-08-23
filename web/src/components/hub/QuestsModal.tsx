import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import type { HubQuestDef } from '../../data/hub/questDefs'
import { getQuestState } from '../../game/hub/quests'
import {
  buildNpcHomeIndex, buildActiveQuestViews, buildCompletedQuestViews, rewardSummary,
  type QuestView, type TownRegistry,
} from '../../game/hub/questBoard'
import { SatchelEmpty } from './satchel/SatchelSheet'
import { FilterChips } from './satchel/FilterChips'
import { GroupHeading } from './satchel/GroupHeading'
import { ListRow } from './satchel/ListRow'
import { QuestReadyCard, QuestProgressRow } from './satchel/QuestRows'

type QuestFilter = 'active' | 'ready' | 'bounties' | 'completed'

interface Props {
  onAbandon: (questId: string) => void
  /** EVERY town's quest defs. A quest accepted in one town and carried to
   *  another used to vanish from this list while its items stayed in the bag. */
  questDefs: HubQuestDef[]
  /** All towns' data, for naming quest targets and the towns they're in. */
  registry: TownRegistry
  /** The town the player is standing in — null on the world map. */
  currentTownName?: string | null
  /** Named NPCs and animals present in that town right now. */
  presentNpcIds?: Set<string>
  /** Pin the target on the minimap. Absent where there is no minimap. */
  onShowOnMap?: (npcId: string) => void
  /** Filters the list by title. Supplied by the sheet's search field. */
  query?: string
}

/** Discovered / total, for the sheet header's meta slot. */
export function questsMeta(questDefs: HubQuestDef[]): string {
  const seen = questDefs.filter(q => getQuestState(q.id).status !== 'available').length
  return `${seen} of ${questDefs.length}`
}

export function QuestsContent({
  onAbandon, questDefs, registry, currentTownName, presentNpcIds, onShowOnMap, query = '',
}: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<QuestFilter>('active')

  const npcHomes = React.useMemo(() => buildNpcHomeIndex(registry), [registry])

  const views = buildActiveQuestViews(questDefs, {
    npcHomes,
    presentNpcIds: presentNpcIds ?? new Set<string>(),
    currentTownName: currentTownName ?? '',
  })
  const completed = buildCompletedQuestViews(questDefs)

  const matches = (title: string) => title.toLowerCase().includes(query.trim().toLowerCase())
  const visible = views.filter(v => matches(v.title))

  const readyHere      = visible.filter(v => v.ready && v.target?.here !== false)
  const readyElsewhere = visible.filter(v => v.ready && v.target?.here === false)
  const inProgress     = visible.filter(v => !v.ready)
  const bounties       = visible.filter(v => v.kind === 'bounty')
  const visibleDone    = completed.filter(q => matches(q.title))

  const abandonButton = (view: QuestView) => view.kind === 'bounty' ? null : (
    <button
      type="button"
      className="quests-modal__abandon-btn"
      title="Abandon quest"
      aria-label={`Abandon ${view.title}`}
      onClick={() => setConfirmingId(confirmingId === view.id ? null : view.id)}
    >✕</button>
  )

  const confirmRow = (view: QuestView) => confirmingId !== view.id ? null : (
    <div className="quests-modal__confirm">
      <span>Abandon this quest? Collected items will return to the world.</span>
      <div className="quests-modal__confirm-btns">
        <button onClick={() => { onAbandon(view.id); setConfirmingId(null) }}>Abandon</button>
        <button onClick={() => setConfirmingId(null)}>Cancel</button>
      </div>
    </div>
  )

  const progressRow = (view: QuestView) => (
    <React.Fragment key={view.id}>
      <QuestProgressRow view={view} onShowOnMap={onShowOnMap} actions={abandonButton(view)} />
      {confirmRow(view)}
    </React.Fragment>
  )

  const readyCard = (view: QuestView) => (
    <React.Fragment key={view.id}>
      <QuestReadyCard view={view} onShowOnMap={onShowOnMap} />
      {confirmRow(view)}
    </React.Fragment>
  )

  return (
    <>
      <FilterChips
        label="Filter quests"
        activeId={filter}
        onChange={id => setFilter(id as QuestFilter)}
        options={[
          { id: 'active',    label: 'Active',    count: views.length },
          { id: 'ready',     label: 'Ready',     count: views.filter(v => v.ready).length },
          { id: 'bounties',  label: 'Bounties',  count: views.filter(v => v.kind === 'bounty').length },
          { id: 'completed', label: 'Completed', count: completed.length },
        ]}
      />

      {filter === 'active' && (
        views.length === 0
          ? <SatchelEmpty>No quests active yet — talk to the townsfolk.</SatchelEmpty>
          : visible.length === 0
            ? <SatchelEmpty>No active quest matches “{query}”.</SatchelEmpty>
            : (
              <>
                {readyHere.length > 0 && (
                  <>
                    <GroupHeading tone="gold" count={readyHere.length}>Ready to hand in</GroupHeading>
                    {readyHere.map(readyCard)}
                  </>
                )}
                {inProgress.length > 0 && (
                  <>
                    <GroupHeading count={inProgress.length}>In progress</GroupHeading>
                    {inProgress.map(progressRow)}
                  </>
                )}
                {readyElsewhere.length > 0 && (
                  <>
                    <GroupHeading count={readyElsewhere.length}>Waiting in another town</GroupHeading>
                    {readyElsewhere.map(readyCard)}
                  </>
                )}
              </>
            )
      )}

      {filter === 'ready' && (
        readyHere.length + readyElsewhere.length === 0
          ? <SatchelEmpty>Nothing is ready to hand in yet.</SatchelEmpty>
          : (
            <>
              {readyHere.map(readyCard)}
              {readyElsewhere.map(readyCard)}
            </>
          )
      )}

      {filter === 'bounties' && (
        bounties.length === 0
          ? <SatchelEmpty>No bounties accepted — check the bounty board.</SatchelEmpty>
          : bounties.map(v => v.ready ? readyCard(v) : progressRow(v))
      )}

      {filter === 'completed' && (
        visibleDone.length === 0
          ? <SatchelEmpty>{query ? `No finished quest matches “${query}”.` : 'Nothing finished yet.'}</SatchelEmpty>
          : visibleDone.map(q => (
              <ListRow key={q.id} icon="✅" title={q.title} value={rewardSummary(q.reward)} tone="dim" />
            ))
      )}
    </>
  )
}

/** Standalone quests dialog — still used by the world map screen, which has no
 *  Satchel sheet to host the content. */
export function QuestsModal({ onClose, ...content }: Props & { onClose: () => void }) {
  return (
    <ModalBackdrop onClose={onClose} title="Quests">
      <Panel elevation="floating" className="quests-modal">
        <div className="quests-modal__header">
          <span>📜 Quests</span>
          <span className="quests-modal__meta">
            {questsMeta(content.questDefs)}
            <button className="quests-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </span>
        </div>
        <QuestsContent {...content} />
      </Panel>
    </ModalBackdrop>
  )
}
