import React, { useMemo, useState } from 'react'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, loadNodeHistory, getActiveModifiers, loadActCount } from '../game/questline'
import { StatRow } from './StatRow'

interface Props {
  act: Act
  run: RunState
  onSelectNode: (node: QuestNode) => void
  onBack: () => void
}

const NODE_ICON: Record<string, string> = {
  battle:   '⚔',
  elite:    '★',
  boss:     '☠',
  rest:     '⛺',
  event:    '?',
  merchant: '⚖',
}

const NODE_LABEL: Record<string, string> = {
  battle:   'BATTLE',
  elite:    'ELITE',
  boss:     'BOSS',
  rest:     'REST',
  event:    'EVENT',
  merchant: 'SHOP',
}

type NodeStatus = 'completed' | 'available' | 'skipped' | 'locked' | 'pending'

function getNodeStatus(
  nodeId: string,
  availableIds: string[],
  run: RunState,
): NodeStatus {
  if (run.pendingNodeId === nodeId)          return 'pending'
  if (run.completedNodeIds.includes(nodeId)) return 'completed'
  if (run.skippedNodeIds.includes(nodeId))   return 'skipped'
  if (availableIds.includes(nodeId))         return 'available'
  return 'locked'
}

function hpColor(hp: number, max: number): string {
  const pct = hp / max
  if (pct > 0.6) return '#33ff33'
  if (pct > 0.3) return '#ffcc00'
  return '#ff4444'
}

// Rows sorted top→bottom (row 0 first; boss last)
function buildRows(act: Act): QuestNode[][] {
  const byRow: Record<number, QuestNode[]> = {}
  for (const node of Object.values(act.nodes)) {
    if (!byRow[node.row]) byRow[node.row] = []
    byRow[node.row].push(node)
  }
  return Object.keys(byRow)
    .map(Number)
    .sort((a, b) => a - b)
    .map(r => byRow[r].sort((a, b) => a.col - b.col))
}

// ── SVG connector ────────────────────────────────────────────────────────────
// Renders the linking lines between two adjacent rows.
// Uses the explicit parentIds/childIds graph rather than inferring topology
// from row lengths. viewBox is maxCols×1 so column centres sit at col+0.5,
// matching the 1fr CSS grid columns exactly. vectorEffect="non-scaling-stroke"
// keeps the stroke at a fixed 2px regardless of viewBox scaling.

interface ConnProps {
  prevRow: QuestNode[]
  nextRow: QuestNode[]
  maxCols: number
  center: number   // visual column for single-node rows
}

function SVGConnector({ prevRow, nextRow, maxCols, center }: ConnProps) {
  const visualCol = (node: QuestNode, row: QuestNode[]) =>
    row.length === 1 ? center : node.col

  const prevById = new Map(prevRow.map(n => [n.id, n]))

  // Build (parentVisualCol, childVisualCol) pairs from explicit graph edges
  const connections: [number, number][] = []
  for (const child of nextRow) {
    for (const parentId of child.parentIds) {
      const parent = prevById.get(parentId)
      if (parent) connections.push([visualCol(parent, prevRow), visualCol(child, nextRow)])
    }
  }

  if (connections.length === 0) return null

  // Column i centre in viewBox units (viewBox is maxCols wide, 1 tall)
  const cx = (col: number) => col + 0.5

  // Deduplicate identical paths (same parent col → same child col)
  const seen = new Set<string>()
  const unique = connections.filter(([pc, cc]) => {
    const k = `${pc}:${cc}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return (
    <svg
      viewBox={`0 0 ${maxCols} 1`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '40px', display: 'block', overflow: 'visible' }}
    >
      {unique.map(([pc, cc], i) => (
        <polyline
          key={i}
          // Down to midpoint → across → down to bottom
          points={`${cx(pc)},0 ${cx(pc)},0.5 ${cx(cc)},0.5 ${cx(cc)},1`}
          fill="none"
          stroke="#4a4a4a"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

// ── Reward summary ───────────────────────────────────────────────────────────

function rewardSummary(node: QuestNode): string {
  switch (node.type) {
    case 'battle':   return '1 card reward'
    case 'elite':    return 'Pick 1 of 3 rare+ cards'
    case 'boss':     return 'Relic + card pack + crystals'
    case 'rest':     return `+${node.restHeal ?? 5} HP`
    case 'event':    return 'Random event — choose wisely'
    case 'merchant': return 'Spend crystals to buy cards'
    default:         return ''
  }
}

const DIFFICULTY_LABELS = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Very Hard', 'Brutal']

function difficultyLabel(handicap: number | undefined): string {
  const h = handicap ?? 0
  return DIFFICULTY_LABELS[Math.min(h, DIFFICULTY_LABELS.length - 1)]
}

function difficultyColor(handicap: number | undefined): string {
  const h = handicap ?? 0
  if (h <= 1) return '#33ff33'
  if (h <= 3) return '#ffcc00'
  if (h <= 5) return '#ff8844'
  return '#ff4444'
}

const BOSS_AI_DESCRIPTIONS: Record<string, string> = {
  thornlord: 'Builds walls every turn — floods the field with structures and outlasts you.',
}

function playstyleDescription(node: QuestNode): string {
  if (node.bossAI && BOSS_AI_DESCRIPTIONS[node.bossAI]) {
    return BOSS_AI_DESCRIPTIONS[node.bossAI]
  }
  if (node.enemyDeck && node.enemyDeck.length > 0) {
    return `Deck: ${node.enemyDeck.join(', ')}`
  }
  return 'Plays a standard shuffled deck.'
}

// ── Node Peek Modal ──────────────────────────────────────────────────────────

interface PeekModalProps {
  node: QuestNode
  actId: string
  nodeHistory: Set<string>
  activeModifiers: ReplayModifier[]
  onEnter: () => void
  onClose: () => void
}

function NodePeekModal({ node, actId, nodeHistory, activeModifiers, onEnter, onClose }: PeekModalProps) {
  const hasPreviouslyCompleted = nodeHistory.has(`${actId}:${node.id}`)
  const isBattle = node.type === 'battle' || node.type === 'elite' || node.type === 'boss'

  return (
    <div className="nm-peek-backdrop" onClick={onClose}>
      <div className="nm-peek-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nm-peek-header">
          <span className={`nm-peek-type nm-node-type-badge--${node.type}`}>
            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
          </span>
          <span className="nm-peek-icon">{NODE_ICON[node.type] ?? '?'}</span>
          <span className="nm-peek-name">{node.label}</span>
        </div>

        {/* Description */}
        {node.description && (
          <div className="nm-peek-desc">{node.description}</div>
        )}

        {/* Reward */}
        <StatRow label="REWARD" value={<span className="nm-peek-reward">{rewardSummary(node)}</span>} />

        {/* Difficulty (battle nodes only) */}
        {isBattle && (
          <StatRow
            label="DIFFICULTY"
            value={<span style={{ color: difficultyColor(node.handicap) }}>{difficultyLabel(node.handicap)}</span>}
          />
        )}

        {/* Previously completed — reveal opponent deck */}
        {hasPreviouslyCompleted && isBattle && (
          <div className="nm-peek-history">
            <div className="nm-peek-history-label">— INTEL (from previous run) —</div>
            <div className="nm-peek-history-body">{playstyleDescription(node)}</div>
          </div>
        )}

        {/* Active modifiers */}
        {activeModifiers.length > 0 && (
          <div className="nm-peek-modifiers">
            <div className="nm-peek-modifiers-label">— REPLAY MODIFIERS —</div>
            {activeModifiers.map((m, i) => (
              <div key={i} className="nm-peek-modifier-row">
                <span className="nm-peek-modifier-icon">⚠</span>
                <span className="nm-peek-modifier-text">{m.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="nm-peek-actions">
          {(isBattle || node.type === 'event' || node.type === 'merchant') ? (
            <button className="action-btn nm-peek-enter-btn" onClick={onEnter}>
              {node.type === 'rest' ? 'REST' : node.type === 'merchant' ? 'ENTER SHOP' : node.type === 'event' ? 'APPROACH' : 'ENTER BATTLE'}
            </button>
          ) : (
            <button className="action-btn nm-peek-enter-btn" onClick={onEnter}>
              {node.type === 'rest' ? 'REST HERE' : 'PROCEED'}
            </button>
          )}
          <button className="action-btn nm-peek-back-btn" onClick={onClose}>
            BACK
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function NodeMap({ act, run, onSelectNode, onBack }: Props) {
  const availableIds = getAvailableNodeIds(act, run)
  const rows         = useMemo(() => buildRows(act), [act])
  const maxCols      = useMemo(() => Math.max(...rows.map(r => r.length)), [rows])
  const hpPct        = Math.max(0, run.playerHp / run.maxHp)
  const center       = Math.floor(maxCols / 2)  // 0-indexed

  const gridCols = `repeat(${maxCols}, 1fr)`

  // Node peek state
  const [peekNode, setPeekNode] = useState<QuestNode | null>(null)
  const nodeHistory = useMemo(() => loadNodeHistory(), [])

  const handleNodeClick = (node: QuestNode) => {
    setPeekNode(node)
  }

  const handlePeekEnter = () => {
    if (!peekNode) return
    setPeekNode(null)
    onSelectNode(peekNode)
  }

  return (
    <div className="nodemap">
      {/* Header */}
      <div className="nm-header">
        <div className="nm-act-label">
          <span className="nm-act-title">{act.title}</span>
          <span className="nm-act-sub">{act.subtitle}</span>
        </div>
        <div className="nm-hp-area">
          <span className="nm-hp-label">HP</span>
          <div className="nm-hp-track">
            <div
              className="nm-hp-fill"
              style={{ width: `${hpPct * 100}%`, background: hpColor(run.playerHp, run.maxHp) }}
            />
          </div>
          <span className="nm-hp-text" style={{ color: hpColor(run.playerHp, run.maxHp) }}>
            {run.playerHp}/{run.maxHp}
          </span>
        </div>
        <div className="nm-lives-area" title="Lives remaining — lose them all and the campaign ends">
          {Array.from({ length: run.maxLives ?? 3 }).map((_, i) => (
            <span key={i} className={`nm-life-pip ${i < (run.livesRemaining ?? 3) ? 'nm-life-pip--full' : 'nm-life-pip--empty'}`}>♥</span>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="nm-map">
        <div className="nm-map-inner">
          {rows.map((rowNodes, rowIndex) => {
            return (
              <React.Fragment key={rowIndex}>
                {/* Connector above this row */}
                {rowIndex > 0 && (
                  <SVGConnector
                    prevRow={rows[rowIndex - 1]}
                    nextRow={rowNodes}
                    maxCols={maxCols}
                    center={center}
                  />
                )}

                {/* Row of nodes */}
                <div className="nm-row" style={{ gridTemplateColumns: gridCols }}>
                  {rowNodes.map((node) => {
                    const status   = getNodeStatus(node.id, availableIds, run)
                    const clickable = status === 'available'
                    // Single-node rows are always centred; multi-node rows use col
                    const gridCol  = rowNodes.length === 1 ? center + 1 : node.col + 1

                    return (
                      <div
                        key={node.id}
                        style={{ gridColumn: gridCol, display: 'flex', justifyContent: 'center' }}
                      >
                        <button
                          className={[
                            'nm-node',
                            `nm-node--${node.type}`,
                            `nm-node--${status}`,
                          ].join(' ')}
                          onClick={clickable ? () => handleNodeClick(node) : undefined}
                          disabled={!clickable}
                          title={node.description}
                        >
                          <span className={`nm-node-type-badge nm-node-type-badge--${node.type}`}>
                            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
                          </span>
                          <span className="nm-node-icon">{NODE_ICON[node.type] ?? '?'}</span>
                          <span className="nm-node-name">{node.label}</span>
                          <span className="nm-node-status">
                            {status === 'completed' && '✓'}
                            {status === 'pending'   && '…'}
                            {status === 'skipped'   && '╳'}
                            {status === 'available' && node.type === 'rest'
                              ? `+${node.restHeal} HP`
                              : status === 'available' ? 'PEEK' : ''}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <button className="action-btn nm-back-btn" onClick={onBack}>
        ← MAIN MENU
      </button>

      {/* Node peek modal */}
      {peekNode && (
        <NodePeekModal
          node={peekNode}
          actId={act.id}
          nodeHistory={nodeHistory}
          activeModifiers={getActiveModifiers(act, loadActCount(act.id))}
          onEnter={handlePeekEnter}
          onClose={() => setPeekNode(null)}
        />
      )}
    </div>
  )
}
