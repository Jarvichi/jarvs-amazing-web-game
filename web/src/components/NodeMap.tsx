import React, { useMemo, useRef, useEffect, useState } from 'react'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, loadNodeHistory, getModifiersByCount, ALL_CONSUMABLES } from '../game/questline'
import { StatRow } from './StatRow'

interface Props {
  act: Act
  run: RunState
  onSelectNode: (node: QuestNode) => void
  onUseConsumable: (id: string) => void
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

const COL_WIDTH = 112 // fixed pixel width per map column slot

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

/**
 * BFS from start nodes (parentIds === []) following non-skipped edges.
 * Returns the set of node IDs that can still be reached in the current run.
 * Completed, available, and future-path nodes are all included; skipped and
 * their descendants that have no other parent are excluded.
 */
function computeReachableIds(act: Act, run: RunState): Set<string> {
  const skipped = new Set(run.skippedNodeIds)
  const reachable = new Set<string>()

  function visit(id: string) {
    if (reachable.has(id) || skipped.has(id)) return
    reachable.add(id)
    const node = act.nodes[id]
    if (!node) return
    for (const childId of node.childIds) {
      visit(childId)
    }
  }

  for (const [id, node] of Object.entries(act.nodes)) {
    if (node.parentIds.length === 0 && !skipped.has(id)) visit(id)
  }
  return reachable
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
// Renders cubic-bezier curves between adjacent rows.
// viewBox is maxCols×1; column centres at col+0.5, matching the CSS grid.
// Each path is coloured by the status of its parent→child pair.

interface ConnProps {
  prevRow:      QuestNode[]
  nextRow:      QuestNode[]
  maxCols:      number
  statusOf:     (id: string) => NodeStatus
  reachableIds: Set<string>
}

type LineVariant = 'trail' | 'frontier' | 'future' | 'dead'

function lineVariant(
  parentId: string, childId: string,
  statusOf: (id: string) => NodeStatus,
  reachableIds: Set<string>,
): LineVariant {
  const ps = statusOf(parentId)
  const cs = statusOf(childId)
  if (!reachableIds.has(parentId) || !reachableIds.has(childId)) return 'dead'
  if (ps === 'completed' && (cs === 'completed' || cs === 'pending')) return 'trail'
  if (ps === 'completed' && cs === 'available')                       return 'frontier'
  return 'future'
}

const LINE_STROKE: Record<LineVariant, string> = {
  trail:    'rgba(51,255,51,0.35)',
  frontier: 'rgba(51,255,51,0.75)',
  future:   'rgba(255,255,255,0.1)',
  dead:     'rgba(255,255,255,0.03)',
}
const LINE_WIDTH: Record<LineVariant, number> = {
  trail: 1.5, frontier: 2, future: 1.5, dead: 1,
}

function SVGConnector({ prevRow, nextRow, maxCols, statusOf, reachableIds }: ConnProps) {
  const prevRowCols = prevRow[0]?.rowCols ?? prevRow.length
  const nextRowCols = nextRow[0]?.rowCols ?? nextRow.length

  // Absolute column position within the maxCols-wide container
  const visualCol = (node: QuestNode, rowCols: number) =>
    (maxCols - rowCols) / 2 + node.col

  const nextById = new Map(nextRow.map(n => [n.id, n]))

  // Build connections from parent.childIds — fixes missing connectors when only
  // one direction of the edge is populated in the act JSON.
  const connections: [string, string, number, number][] = []
  for (const parent of prevRow) {
    for (const childId of parent.childIds) {
      const child = nextById.get(childId)
      if (child) {
        connections.push([parent.id, child.id, visualCol(parent, prevRowCols), visualCol(child, nextRowCols)])
      }
    }
  }

  if (connections.length === 0) return null

  // Column i centre in viewBox units (viewBox is maxCols wide, 1 tall)
  const cx = (vc: number) => vc + 0.5

  // Deduplicate by visual column pair (keep highest-priority variant)
  const variantPriority: Record<LineVariant, number> = { frontier: 3, trail: 2, future: 1, dead: 0 }
  const best = new Map<string, { variant: LineVariant; pc: number; cc: number }>()
  for (const [pid, cid, pc, cc] of connections) {
    const key = `${pc}:${cc}`
    const v = lineVariant(pid, cid, statusOf, reachableIds)
    const existing = best.get(key)
    if (!existing || variantPriority[v] > variantPriority[existing.variant]) {
      best.set(key, { variant: v, pc, cc })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${maxCols} 1`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '44px', display: 'block', overflow: 'visible' }}
    >
      {Array.from(best.values()).map(({ variant, pc, cc }, i) => {
        const x1 = cx(pc), x2 = cx(cc)
        // Cubic bezier: depart/arrive vertically, smooth horizontal transition
        const d = `M ${x1},0 C ${x1},0.5 ${x2},0.5 ${x2},1`
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={LINE_STROKE[variant]}
            strokeWidth={LINE_WIDTH[variant]}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
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

/** Collapse multiple modifiers of the same type into one row with summed values. */
function collapseModifiers(modifiers: ReplayModifier[]): ReplayModifier[] {
  const byType = new Map<string, number>()
  for (const m of modifiers) {
    byType.set(m.type, (byType.get(m.type) ?? 0) + m.value)
  }
  return Array.from(byType.entries()).map(([type, total]) => {
    switch (type) {
      case 'enemyHpPercent':         return { type: type as ReplayModifier['type'], value: total, label: `+${total}% enemy HP` }
      case 'crystalBonus':           return { type: type as ReplayModifier['type'], value: total, label: `+${total} crystals per battle` }
      case 'enemyHandBonus':         return { type: type as ReplayModifier['type'], value: total, label: `Enemies start +${total} card${total !== 1 ? 's' : ''}` }
      case 'enemyIntervalReduction': return modifiers.find(m => m.type === type)!
      default:                       return modifiers.find(m => m.type === type)!
    }
  })
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

        {/* Active modifiers (battle nodes only) — same-type entries are summed */}
        {isBattle && activeModifiers.length > 0 && (
          <div className="nm-peek-modifiers">
            <div className="nm-peek-modifiers-label">— REPLAY MODIFIERS —</div>
            {collapseModifiers(activeModifiers).map((m, i) => (
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

export function NodeMap({ act, run, onSelectNode, onUseConsumable, onBack }: Props) {
  const availableIds  = getAvailableNodeIds(act, run)
  const rows          = useMemo(() => buildRows(act), [act])
  const maxRowCols    = useMemo(() => Math.max(...rows.map(r => r[0]?.rowCols ?? r.length)), [rows])
  const hpPct         = Math.max(0, run.playerHp / run.maxHp)
  const reachableIds  = useMemo(() => computeReachableIds(act, run), [act, run])

  const statusOf = (id: string): NodeStatus => getNodeStatus(id, availableIds, run)

  // Node peek state
  const [peekNode, setPeekNode] = useState<QuestNode | null>(null)
  const nodeHistory = useMemo(() => loadNodeHistory(), [])

  // Scroll to the current node (pending or first available) on mount
  const mapRef     = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  const currentNodeId = run.pendingNodeId
    ?? rows.flatMap(r => r).find(n => availableIds.includes(n.id))?.id

  useEffect(() => {
    const mapEl  = mapRef.current
    const nodeEl = currentRef.current
    if (!mapEl || !nodeEl) return
    const mapRect  = mapEl.getBoundingClientRect()
    const nodeRect = nodeEl.getBoundingClientRect()
    mapEl.scrollTop = mapEl.scrollTop + nodeRect.top - mapRect.top
      - (mapRect.height - nodeRect.height) / 2
  }, [])

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

      {/* Consumables bar */}
      <div className="nm-consumables-bar">
        <span className="nm-consumables-label">ITEMS</span>
        {ALL_CONSUMABLES.map(def => {
          const rc = run.consumables?.find(c => c.id === def.id)
          const count = rc?.count ?? 0
          return (
            <button
              key={def.id}
              className={`nm-consumable-btn${count === 0 ? ' nm-consumable-btn--empty' : ''}`}
              title={count > 0 ? `${def.name}: ${def.desc}` : `${def.name} (none)`}
              disabled={count === 0}
              onClick={() => onUseConsumable(def.id)}
            >
              <span className="nm-consumable-icon">{def.icon}</span>
              <span className="nm-consumable-name">{def.name}</span>
              <span className="nm-consumable-count">×{count}</span>
            </button>
          )
        })}
      </div>

      {/* Map */}
      <div className="nm-map" ref={mapRef}>
        <div className="nm-map-inner" style={{ width: `${maxRowCols * COL_WIDTH}px` }}>
          {rows.map((rowNodes, rowIndex) => {
            const rowCols = rowNodes[0]?.rowCols ?? rowNodes.length
            return (
              <React.Fragment key={rowIndex}>
                {/* Connector above this row */}
                {rowIndex > 0 && (
                  <SVGConnector
                    prevRow={rows[rowIndex - 1]}
                    nextRow={rowNodes}
                    maxCols={maxRowCols}
                    statusOf={statusOf}
                    reachableIds={reachableIds}
                  />
                )}

                {/* Row of nodes — fixed-width columns, centred in the container */}
                <div
                  className="nm-row"
                  style={{
                    gridTemplateColumns: `repeat(${rowCols}, ${COL_WIDTH}px)`,
                    width: `${rowCols * COL_WIDTH}px`,
                    margin: '0 auto',
                    gap: 0,
                  }}
                >
                  {rowNodes.map((node) => {
                    const status    = getNodeStatus(node.id, availableIds, run)
                    const clickable = status === 'available'
                    const dim = status === 'completed'
                             || status === 'skipped'
                             || (status === 'locked' && !reachableIds.has(node.id))
                    const isCurrent = node.id === currentNodeId

                    return (
                      <div
                        key={node.id}
                        ref={isCurrent ? currentRef : undefined}
                        style={{ gridColumn: node.col + 1, display: 'flex', justifyContent: 'center' }}
                      >
                        <button
                          className={[
                            'nm-node',
                            `nm-node--${node.type}`,
                            `nm-node--${status}`,
                            dim ? 'nm-node--dim' : '',
                          ].filter(Boolean).join(' ')}
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
          activeModifiers={getModifiersByCount(act, run.activeModifierCount)}
          onEnter={handlePeekEnter}
          onClose={() => setPeekNode(null)}
        />
      )}
    </div>
  )
}
