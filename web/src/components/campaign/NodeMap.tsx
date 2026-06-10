import { User } from 'firebase/auth'
import React, { useMemo, useState } from 'react'
import { GIFT_OWNER_UID } from '../../game/gifts'
import { ALL_CONSUMABLES, ARCHETYPE_DEFS, Act, QuestNode, RunState, getAvailableNodeIds, getModifiersByCount, loadNodeHistory } from '../../game/questline'
import { Lives } from '../ui/Lives/Lives'
import { NodeMapRederer, getNodeStatus } from '../ui/NodeMap/NodeMapRederer'
import { NodePeekModal } from '../ui/NodeMap/NodePeekModal'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
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

  const handlePeekEnter = () => {
    if (!peekNode) return
    setPeekNode(null)
    onSelectNode(peekNode)
  }

  const statusOf = (id: string) => getNodeStatus(id, availableIds, run)

  return (
    <OverlayScreen onBack={onBack} title={act.title} subtitle={act.subtitle}>
      <div className="nodemap u-col u-grow">

        <Toolbar>
          {run.archetype && (() => {
            const def = ARCHETYPE_DEFS.find(d => d.id === run.archetype)
            return def ? <ToolbarLabel>{def.icon} {def.name}</ToolbarLabel> : null
          })()}
          <ToolbarLabel>Items</ToolbarLabel>
          {ALL_CONSUMABLES.map(def => {
            const rc    = run.consumables?.find(c => c.id === def.id)
            const count = rc?.count ?? 0
            return (
              <React.Fragment key={def.id}>
                <ToolbarButton
                  label={`${def.name} ×${count}`}
                  icon={def.icon}
                  disabled={count === 0}
                  onClick={() => onUseConsumable(def.id)}
                />
              </React.Fragment>
            )
          })}
          <ToolbarSpacer />
          <ToolbarButton
            label={showPaths ? 'Hide paths' : 'Show paths'}
            icon={showPaths ? '🛤' : '🗺'}
            onClick={() => setShowPaths(v => !v)}
          />
          {user?.uid === GIFT_OWNER_UID && (
            <ToolbarButton
              label="Copy Debug State"
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

        {peekNode && (
          <NodePeekModal
            node={peekNode}
            actId={act.id}
            nodeHistory={nodeHistory}
            activeModifiers={getModifiersByCount(act, run.activeModifierCount)}
            onEnter={handlePeekEnter}
            onClose={() => setPeekNode(null)}
          />
        )}
      </div>

      <Toolbar>
        <ToolbarSpacer />
        <div className="u-col u-gap-1 u-mg-t-lg u-mg-b-md">
          <NodeMapHpBar hp={run.playerHp} maxHp={run.maxHp} />
          <div className="nm-lives-area u-flex u-items-end u-just-end u-gap-1"
            title="Lives remaining — lose them all and the campaign ends">
            <Lives maxLives={run.maxLives ?? 3} currentLives={run.livesRemaining ?? 3} />
          </div>
        </div>
      </Toolbar>
    </OverlayScreen>
  )
}
