// ── Node Peek Modal ────────────────────────────────────────────────────────────

import { QuestNode, ReplayModifier } from "../../../game/questline";
import { StatRow } from "../StatRow";
import { NODE_ICON, NODE_LABEL } from "./constants";

// ── Reward / difficulty helpers ───────────────────────────────────────────────

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
  return DIFFICULTY_LABELS[Math.min(handicap ?? 0, DIFFICULTY_LABELS.length - 1)]
}
function difficultyColor(handicap: number | undefined): string {
  const h = handicap ?? 0
  return h <= 1 ? '#33ff33' : h <= 3 ? '#ffcc00' : h <= 5 ? '#ff8844' : '#ff4444'
}

const BOSS_AI_DESCRIPTIONS: Record<string, string> = {
  thornlord: 'Builds walls every turn — floods the field with structures and outlasts you.',
}
function playstyleDescription(node: QuestNode): string {
  if (node.bossAI && BOSS_AI_DESCRIPTIONS[node.bossAI]) return BOSS_AI_DESCRIPTIONS[node.bossAI]
  if (node.enemyDeck?.length) return `Deck: ${node.enemyDeck.join(', ')}`
  return 'Plays a standard shuffled deck.'
}

function collapseModifiers(modifiers: ReplayModifier[]): ReplayModifier[] {
  const byType = new Map<string, number>()
  for (const m of modifiers) byType.set(m.type, (byType.get(m.type) ?? 0) + m.value)
  return Array.from(byType.entries()).map(([type, total]) => {
    switch (type) {
      case 'enemyHpPercent':  return { type: type as ReplayModifier['type'], value: total, label: `+${total}% enemy HP` }
      case 'crystalBonus':    return { type: type as ReplayModifier['type'], value: total, label: `+${total} crystals per battle` }
      case 'enemyHandBonus':  return { type: type as ReplayModifier['type'], value: total, label: `Enemies start +${total} card${total !== 1 ? 's' : ''}` }
      default:                return modifiers.find(m => m.type === type)!
    }
  })
}


interface PeekModalProps {
  node: QuestNode
  actId?: string
  nodeHistory?: Set<string>
  activeModifiers?: ReplayModifier[]
  onEnter: () => void
  onClose: () => void
  // world mode
  mode?: 'campaign' | 'world'
  isCleared?: boolean
  isAvailable?: boolean
}

export function NodePeekModal({
  node, actId = '', nodeHistory = new Set(), activeModifiers = [],
  onEnter, onClose,
  mode = 'campaign', isCleared = false, isAvailable = true,
}: PeekModalProps) {
  const hasPreviouslyCompleted = nodeHistory.has(`${actId}:${node.id}`)
  const isBattle = node.type === 'battle' || node.type === 'elite' || node.type === 'boss'
  return (
    <div className="nm-peek-backdrop" onClick={onClose}>
      <div className="nm-peek-panel" onClick={e => e.stopPropagation()}>
        <div className="nm-peek-header u-col u-items-c u-gap-1">
          <span className={`nm-peek-type nm-node-type-badge--${node.type}`}>
            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
          </span>
          <span className="nm-peek-icon">{NODE_ICON[node.type] ?? '?'}</span>
          <span className="nm-peek-name">{node.label}</span>
        </div>
        {mode === 'world' ? (
          <>
            {node.description && <div className="nm-peek-desc">{node.description}</div>}
            {isCleared && (
              <div style={{ color: '#aaaaaa', fontSize: 12, textAlign: 'center', margin: '6px 0' }}>
                ✓ Cleared
              </div>
            )}
            {!isAvailable && !isCleared && (
              <div style={{ color: '#888', fontSize: 12, textAlign: 'center', margin: '6px 0' }}>
                🔒 Not yet accessible
              </div>
            )}
            <div className="nm-peek-actions u-flex u-gap-4">
              {isAvailable && (
                <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
                  {node.type === 'battle' && !isCleared ? 'ENTER BATTLE ⚔' : 'TRAVEL ➤'}
                </button>
              )}
              <button className="action-btn nm-peek-back-btn" onClick={onClose}>BACK</button>
            </div>
          </>
        ) : (
          <>
            {node.description && <div className="nm-peek-desc">{node.description}</div>}
            <StatRow label="REWARD" value={<span className="nm-peek-reward">{rewardSummary(node)}</span>} />
            {isBattle && (
              <StatRow label="DIFFICULTY"
                value={<span style={{ color: difficultyColor(node.handicap) }}>{difficultyLabel(node.handicap)}</span>} />
            )}
            {hasPreviouslyCompleted && isBattle && (
              <div className="nm-peek-history u-col u-gap-2">
                <div className="nm-peek-history-label">— INTEL (from previous run) —</div>
                <div className="nm-peek-history-body">{playstyleDescription(node)}</div>
              </div>
            )}
            {isBattle && activeModifiers.length > 0 && (
              <div className="nm-peek-modifiers">
                <div className="nm-peek-modifiers-label">— REPLAY MODIFIERS —</div>
                {collapseModifiers(activeModifiers).map((m, i) => (
                  <div key={i} className="nm-peek-modifier-row u-flex u-items-c u-gap-3">
                    <span className="nm-peek-modifier-icon">⚠</span>
                    <span className="nm-peek-modifier-text">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="nm-peek-actions u-flex u-gap-4">
              {(isBattle || node.type === 'event' || node.type === 'merchant') ? (
                <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
                  {node.type === 'merchant' ? 'ENTER SHOP' : node.type === 'event' ? 'APPROACH' : 'ENTER BATTLE'}
                </button>
              ) : (
                <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
                  {node.type === 'rest' ? 'REST HERE' : 'PROCEED'}
                </button>
              )}
              <button className="action-btn nm-peek-back-btn" onClick={onClose}>BACK</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}