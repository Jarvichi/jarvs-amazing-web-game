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

const COL_WIDTH  = 112 // fixed pixel width per map column slot
const ROW_HEIGHT = 112 // fixed pixel height per vertical node slot within a column

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

  // Build reverse map to find start nodes (those with no parents)
  const hasParent = new Set<string>()
  for (const node of Object.values(act.nodes)) {
    for (const cid of node.childIds) hasParent.add(cid)
  }
  for (const [id] of Object.entries(act.nodes)) {
    if (!hasParent.has(id) && !skipped.has(id)) visit(id)
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
// Renders cubic-bezier curves between adjacent columns (L→R layout).
// viewBox is 1×maxRows; row centres at row+0.5, matching the CSS grid.
// Each path is coloured by the status of its parent→child pair.

interface ConnProps {
  prevRow:      QuestNode[]
  nextRow:      QuestNode[]
  maxRows:      number
  statusOf:     (id: string) => NodeStatus
  reachableIds: Set<string>
  environment?: string
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

function envColors(env?: string): { trail: string; frontier: string } {
  switch (env) {
    case 'forest':   return { trail: 'rgba(80,140,60,0.6)',   frontier: 'rgba(100,220,80,0.9)'  }
    case 'citadel':
    case 'ruins':    return { trail: 'rgba(120,120,140,0.55)', frontier: 'rgba(180,180,210,0.9)' }
    case 'ashen':    return { trail: 'rgba(160,80,40,0.55)',   frontier: 'rgba(240,120,60,0.9)'  }
    case 'farmland': return { trail: 'rgba(140,160,60,0.55)',  frontier: 'rgba(200,220,80,0.9)'  }
    case 'frost':    return { trail: 'rgba(80,160,200,0.55)',  frontier: 'rgba(120,220,255,0.9)' }
    case 'volcano':  return { trail: 'rgba(200,80,20,0.6)',    frontier: 'rgba(255,120,30,0.95)' }
    case 'sand':     return { trail: 'rgba(200,160,60,0.55)',  frontier: 'rgba(240,200,80,0.9)'  }
    case 'reef':
    case 'coast':    return { trail: 'rgba(40,140,180,0.55)',  frontier: 'rgba(60,200,240,0.9)'  }
    case 'sky':      return { trail: 'rgba(100,140,200,0.55)', frontier: 'rgba(140,190,255,0.9)' }
    case 'fungal':   return { trail: 'rgba(120,60,160,0.55)',  frontier: 'rgba(180,80,240,0.9)'  }
    case 'vault':
    case 'camp':     return { trail: 'rgba(140,120,80,0.55)',  frontier: 'rgba(200,180,100,0.9)' }
    default:         return { trail: 'rgba(120,120,120,0.45)', frontier: 'rgba(51,255,51,0.85)'  }
  }
}

function SVGConnector({ prevRow, nextRow, maxRows, statusOf, reachableIds, environment }: ConnProps) {
  const prevRowCols = prevRow[0]?.rowCols ?? prevRow.length
  const nextRowCols = nextRow[0]?.rowCols ?? nextRow.length

  // Absolute row position within the maxRows-tall container
  const visualRow = (node: QuestNode, rowCols: number) =>
    (maxRows - rowCols) / 2 + node.col

  const nextById = new Map(nextRow.map(n => [n.id, n]))

  // Build connections from parent.childIds
  const connections: [string, string, number, number][] = []
  for (const parent of prevRow) {
    for (const childId of parent.childIds) {
      const child = nextById.get(childId)
      if (child) {
        connections.push([parent.id, child.id, visualRow(parent, prevRowCols), visualRow(child, nextRowCols)])
      }
    }
  }

  if (connections.length === 0) return null

  // Row i centre in viewBox units (viewBox is 1 wide, maxRows tall)
  const cy = (vr: number) => vr + 0.5

  // Deduplicate by visual row pair (keep highest-priority variant)
  const variantPriority: Record<LineVariant, number> = { frontier: 3, trail: 2, future: 1, dead: 0 }
  const best = new Map<string, { variant: LineVariant; pr: number; cr: number }>()
  for (const [pid, cid, pr, cr] of connections) {
    const key = `${pr}:${cr}`
    const v = lineVariant(pid, cid, statusOf, reachableIds)
    const existing = best.get(key)
    if (!existing || variantPriority[v] > variantPriority[existing.variant]) {
      best.set(key, { variant: v, pr, cr })
    }
  }

  const colors = envColors(environment)

  return (
    <svg
      viewBox={`0 0 1 ${maxRows}`}
      preserveAspectRatio="none"
      style={{ width: '44px', height: '100%', display: 'block', overflow: 'visible', alignSelf: 'stretch', flexShrink: 0 }}
    >
      {Array.from(best.values()).map(({ variant, pr, cr }, i) => {
        const y1 = cy(pr), y2 = cy(cr)
        const d = `M 0,${y1} C 0.5,${y1} 0.5,${y2} 1,${y2}`

        if (variant === 'future') {
          return (
            <path key={i} d={d} fill="none"
              stroke="rgba(255,255,255,0.13)" strokeWidth={2}
              strokeDasharray="0.04 0.06" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
          )
        }
        if (variant === 'dead') {
          return (
            <path key={i} d={d} fill="none"
              stroke="rgba(255,255,255,0.04)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" />
          )
        }
        // trail / frontier — two-layer road look
        const surfaceColor = variant === 'frontier' ? colors.frontier : colors.trail
        const edgeColor    = variant === 'frontier' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.4)'
        const outerWidth   = variant === 'frontier' ? 7 : 6
        const innerWidth   = variant === 'frontier' ? 4 : 3
        return (
          <React.Fragment key={i}>
            <path d={d} fill="none" stroke={edgeColor}    strokeWidth={outerWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke={surfaceColor} strokeWidth={innerWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </React.Fragment>
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
    mapEl.scrollLeft = mapEl.scrollLeft + nodeRect.left - mapRect.left
      - (mapRect.width - nodeRect.width) / 2
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

      {/* Map — left-to-right: each act row renders as a vertical column */}
      <div className={`nm-map${act.environment ? ` nm-map--${act.environment}` : ''}`} ref={mapRef}>
        <div className="nm-map-inner" style={{ height: `${maxRowCols * ROW_HEIGHT}px` }}>
          {rows.map((rowNodes, rowIndex) => {
            const rowCols = rowNodes[0]?.rowCols ?? rowNodes.length
            return (
              <React.Fragment key={rowIndex}>
                {/* Column of nodes — fixed-height rows, centred in the container */}
                <div
                  className="nm-col"
                  style={{
                    gridTemplateRows: `repeat(${rowCols}, ${ROW_HEIGHT}px)`,
                    height: `${rowCols * ROW_HEIGHT}px`,
                    width: `${COL_WIDTH}px`,
                    margin: 'auto 0',
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
                        style={{ gridRow: node.col + 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
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

                {/* Connector to the right of this column */}
                {rowIndex < rows.length - 1 && (
                  <SVGConnector
                    prevRow={rowNodes}
                    nextRow={rows[rowIndex + 1]}
                    maxRows={maxRowCols}
                    statusOf={statusOf}
                    reachableIds={reachableIds}
                    environment={act.environment}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

<div style={{ display: 'flex', justifyContent: 'center' }}>
      <button className="action-btn nm-back-btn" onClick={onBack}>
        ← MAIN MENU
      </button>
</div>

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
