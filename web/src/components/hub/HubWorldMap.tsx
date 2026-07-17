import React, { useState, useMemo, useEffect } from 'react'
import { WORLD_MAP, WorldNodeDef } from '../../data/world/worldMapDef'
import { isNodeCleared } from '../../game/world/worldState'
import { loadPlayerName } from '../../game/questline'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarDropdown } from '../ui/Toolbar/ToolbarDropdown'
import { useHubClock } from '../../hooks/useHubClock'
import { formatGameTime } from '../../game/hub/hubClock'
import { loadCrystals, loadCollection } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { QuestsModal } from './QuestsModal'
import { unmarkPickedUp } from '../../game/hub/pickups'
import { resetQuest } from '../../game/hub/quests'
import { LoginButton } from '../ui/LoginButton'
import type { User } from 'firebase/auth'
import { NodeMapRederer, getWorldNodeStatus } from '../ui/NodeMap/NodeMapRederer'
import { NodePeekModal } from '../ui/NodeMap/NodePeekModal'
import { ALL_QUEST_DEFS } from '../../data/hub/hubWorldFactory'

interface Props {
  onSelectNode:  (node: WorldNodeDef) => void
  onBack:        () => void
  user:         User | null
  onSignIn?:     () => void
  onSignOut?:    () => void
  onPlayerTap?:  () => void
  onFeedback?:   () => void
  restrictedNodeIds?: Set<string>
}

export function HubWorldMap({ onSelectNode, onBack, user, onSignIn, onSignOut, onPlayerTap, onFeedback, restrictedNodeIds }: Props) {
  const [peekNode, setPeekNode] = useState<WorldNodeDef | null>(null)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [wrongSave, setWrongSave]   = useState<{ cards: number; crystals: number; deck: number } | null>(null)

  const { isNight: isGameNight } = useHubClock()
  const playerName = loadPlayerName()
  const crystals   = loadCrystals()

  const clearedNodeIds = useMemo(
    () => new Set(Object.keys(WORLD_MAP.nodes).filter(id => isNodeCleared(id))),
    []
  )

  const { collectionCount, catalogTotal } = useMemo(() => {
    const catalog    = getCardCatalog()
    const collection = loadCollection()
    return {
      collectionCount: collection.filter(e => e.count > 0 && catalog.some(c => c.name === e.cardName)).length,
      catalogTotal: catalog.length,
    }
  }, [])

  const handleQuestAbandon = (questId: string) => {
    const quest = ALL_QUEST_DEFS.find(q => q.id === questId)
    if (!quest) return
    unmarkPickedUp(quest.steps.flatMap(s => s.pickupIds ?? []))
    resetQuest(questId)
  }

  useEffect(() => {
    if (Math.random() > 0.02) return
    const fake = { cards: Math.floor(Math.random() * catalogTotal), crystals: Math.floor(Math.random() * 9999), deck: Math.floor(Math.random() * 10) }
    setWrongSave(fake)
    const id = setTimeout(() => setWrongSave(null), 1800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <OverlayScreen title="🗺 World Map">
      <Toolbar>
        <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>💎 {wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}</ToolbarLabel>
        <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>🃏 {wrongSave ? wrongSave.cards : collectionCount}/{catalogTotal}</ToolbarLabel>
        <ToolbarLabel className="title-deck-info">{isGameNight ? '🌙' : '☀️'} {formatGameTime()}</ToolbarLabel>
        <ToolbarButton icon="📜" title="Quests" onClick={() => setQuestsOpen(true)} />
        <ToolbarButton icon="🏠" title="Back to Town" onClick={onBack} />
        <ToolbarSpacer />

        <div className="toolbar-overflow-inline">
          <LoginButton onSignIn={() => onSignIn?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
          <ToolbarButton
            className="title-auth-btn"
            onClick={onFeedback}
            title="Send feedback or report a bug"
            icon={'🗣️'}
          />
          <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>
        </div>
        <div className="toolbar-overflow-dropdown">
          <ToolbarDropdown label="📊" align="right">
            <LoginButton onSignIn={() => onSignIn?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
            <ToolbarButton
              className="title-auth-btn"
              onClick={onFeedback}
              title="Send feedback or report a bug"
              icon={'🗣️'}
            />
            <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>
          </ToolbarDropdown>
        </div>
      </Toolbar>

      {questsOpen && <QuestsModal onClose={() => setQuestsOpen(false)} onAbandon={handleQuestAbandon} questDefs={ALL_QUEST_DEFS} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <NodeMapRederer
          id="hub-world"
          worldMap={WORLD_MAP}
          clearedNodeIds={clearedNodeIds}
          restrictedNodeIds={restrictedNodeIds}
          mapWidth={1600}
          mapHeight={1400}
          setPeekNode={setPeekNode}
          showPaths={false}
        />
        {peekNode && (
          <NodePeekModal
            node={peekNode}
            mode="world"
            isCleared={isNodeCleared(peekNode.id)}
            isAvailable={getWorldNodeStatus(peekNode, clearedNodeIds, restrictedNodeIds) !== 'locked'}
            onEnter={() => { setPeekNode(null); onSelectNode(peekNode) }}
            onClose={() => setPeekNode(null)}
          />
        )}
      </div>
    </OverlayScreen>
  )
}
