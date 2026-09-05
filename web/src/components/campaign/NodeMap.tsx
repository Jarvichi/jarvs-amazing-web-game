import { User } from 'firebase/auth'
import React, { useMemo, useState } from 'react'
import { GIFT_OWNER_UID } from '../../game/gifts'
import { ALL_CONSUMABLES, ARCHETYPE_DEFS, Act, QuestNode, RunState, getAvailableNodeIds, getModifiersByCount, loadNodeHistory } from '../../game/questline'
import { currentPlayerBandTier } from '../../game/campaignHelpers'
import { buildDeckCards, loadCollection, loadDeck } from '../../game/collection'
import { Lives } from '../ui/Lives/Lives'
import { NodeMapRederer, getNodeStatus } from '../ui/NodeMap/NodeMapRederer'
import { NodePeekModal } from '../ui/NodeMap/NodePeekModal'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarDropdown } from '../ui/Toolbar/ToolbarDropdown'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { NodeMapHpBar } from './NodeMapHpBar'
import { BuildIdentityPanel } from './BuildIdentityPanel'

interface Props {
  act: Act
  run: RunState
  onSelectNode: (node: QuestNode) => void
  onUseConsumable: (id: string) => void
  onBack: () => void
  user?: User | null
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NodeMap({ act, run, onSelectNode, onUseConsumable, onBack, user }: Props) {
  const availableIds      = useMemo(() => getAvailableNodeIds(act.nodes, run), [act, run])
  const [peekNode, setPeekNode] = useState<QuestNode | null>(null)
  const [showPaths, setShowPaths] = useState(true)
  const nodeHistory = useMemo(() => loadNodeHistory(), [])
  // Read once per map visit, not per peek — the deck doesn't change while this screen is open.
  const playerBandTier = useMemo(() => currentPlayerBandTier(buildDeckCards(loadDeck(), loadCollection())), [])

  const handlePeekEnter = () => {
    if (!peekNode) return
    setPeekNode(null)
    onSelectNode(peekNode)
  }

  const statusOf = (id: string) => getNodeStatus(id, availableIds, run)

  const carriedConsumables = ALL_CONSUMABLES.filter(def => !def.guaranteesFragment && !def.preventsLifeLoss)
  const countOf    = (id: string) => run.consumables?.find(c => c.id === id)?.count ?? 0
  const totalItems = carriedConsumables.reduce((n, def) => n + countOf(def.id), 0)

  // Rendered twice — once inline, once inside the narrow-bar menu — with only
  // one of the two displayed at a time by the toolbar's container query.
  const itemControls = (
    <>
      {countOf('memory_charm') > 0 && <ToolbarLabel>🔮 Memory Charm active</ToolbarLabel>}
      {countOf('ward_talisman') > 0 && <ToolbarLabel>🛡 Ward Talisman ready</ToolbarLabel>}
      {carriedConsumables.map(def => (
        <ToolbarButton
          key={def.id}
          label={`${def.name} ×${countOf(def.id)}`}
          icon={def.icon}
          disabled={countOf(def.id) === 0}
          onClick={() => onUseConsumable(def.id)}
        />
      ))}
    </>
  )

  return (
    <OverlayScreen
      onBack={onBack}
      title={act.title}
      subtitle={act.subtitle}
      // Matches the hub: the act map reaches the screen edge rather than
      // sitting inside .game-container's gutter. The toolbars above and below
      // it stay inset — they are bordered boxes, so bleeding them would put a
      // visible border under the phone's corner curve.
      className="overlay-screen overlay-screen--bleed u-col u-grow"
    >
      <div className="nodemap u-col u-grow">

        <Toolbar>
          {run.archetype && (() => {
            const def = ARCHETYPE_DEFS.find(d => d.id === run.archetype)
            return def ? <ToolbarLabel>{def.icon} {def.name}</ToolbarLabel> : null
          })()}
          {/* Wide bar: effects and items sit out in the open. Narrow bar (the
              container query in minigames-1.css): the same nodes move into one
              menu, which is what keeps this toolbar to a single row on a phone
              — it wrapped onto three, taking a third of the screen off the map. */}
          <div className="toolbar-overflow-inline">{itemControls}</div>
          <div className="toolbar-overflow-dropdown">
            <ToolbarDropdown label={`🎒 ×${totalItems}`} title="Items and active effects" align="left">
              {itemControls}
            </ToolbarDropdown>
          </div>
          <ToolbarSpacer />
          <ToolbarButton
            label={showPaths ? 'Hide paths' : 'Show paths'}
            icon={showPaths ? '🛤' : '🗺'}
            onClick={() => setShowPaths(v => !v)}
          />
          {user?.uid === GIFT_OWNER_UID && (
            <ToolbarButton
              title="Copy Debug State"
              icon="🐞"
              onClick={() => {
                const nodeStatuses: Record<string, string> = {}
                for (const node of Object.values(act.nodes))
                  nodeStatuses[node.id] = `${node.type} → ${statusOf(node.id)}`
                const state = {
                  actId: run.actId, pendingNodeId: run.pendingNodeId,
                  completedNodeIds: run.completedNodeIds, skippedNodeIds: run.skippedNodeIds,
                  availableIds, nodeStatuses,
                }
                navigator.clipboard?.writeText(JSON.stringify(state, null, 2)).catch(() => undefined)
                alert('Debug state copied to clipboard (also logged to console).')
              }}
            />
          )}
        </Toolbar>

        <BuildIdentityPanel run={run} />

        <NodeMapRederer id={act.id} run={run} worldMap={act} setPeekNode={setPeekNode} showPaths={showPaths} />

        {/* HUD strip: HP and lives ride the map's bottom edge rather than
            occupying a toolbar band of their own. .nm-map reserves the same
            height as bottom padding, so the map scales into the space above
            the strip instead of underneath it. */}
        <div className="nm-hud u-flex u-items-c u-gap-4">
          <NodeMapHpBar hp={run.playerHp} maxHp={run.maxHp} />
          <div className="nm-lives-area u-flex u-items-c u-gap-1"
            title="Lives remaining — lose them all and the campaign ends">
            <Lives maxLives={run.maxLives ?? 3} currentLives={run.livesRemaining ?? 3} />
          </div>
        </div>

        {peekNode && (
          <NodePeekModal
            node={peekNode}
            actId={act.id}
            nodeHistory={nodeHistory}
            activeModifiers={getModifiersByCount(act, run.activeModifierCount)}
            playerBandTier={playerBandTier}
            expectedBand={act.expectedBand}
            onEnter={handlePeekEnter}
            onClose={() => setPeekNode(null)}
          />
        )}
      </div>
    </OverlayScreen>
  )
}
