import React, { useState, useMemo, useEffect } from 'react'
import { OverlayScreen } from './OverlayScreen'
import { Section } from './Section'
import { ACTS, Act, QuestNode, NodeType } from '../game/questline'
import { getCardCatalog } from '../game/cards'
import battlefieldData from '../data/battlefield.json'

interface Props {
  onBack: () => void
}

const ACT_IDS = [
  'act1','act2','act3','act4','act5','act6','act7',
  'act8','act9','act10','act11','act12','act13','actfinale',
]
const NODE_TYPES: NodeType[] = ['battle', 'elite', 'boss', 'rest', 'event', 'merchant']
const ENVIRONMENTS = Object.keys(
  (battlefieldData as { environments: Record<string, unknown> }).environments
)

function recalculateCols(nodes: Record<string, QuestNode>): Record<string, QuestNode> {
  const byRow: Record<number, QuestNode[]> = {}
  for (const n of Object.values(nodes) as QuestNode[]) {
    if (!byRow[n.row]) byRow[n.row] = []
    byRow[n.row].push(n)
  }
  const updated = { ...nodes }
  for (const group of Object.values(byRow) as QuestNode[][]) {
    group.sort((a, b) => a.col - b.col)
    group.forEach((n, i) => {
      updated[n.id] = { ...n, col: i, rowCols: group.length }
    })
  }
  return updated
}

export function CampaignAdminScreen({ onBack }: Props) {
  const [actId, setActId] = useState('act1')
  const [act, setAct] = useState<Act>(() => JSON.parse(JSON.stringify(ACTS['act1'])))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeIdInput, setNodeIdInput] = useState('')
  const [deckSearch, setDeckSearch] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const allCards = useMemo(() => getCardCatalog(), [])
  const selectedNode = selectedNodeId ? (act.nodes[selectedNodeId] ?? null) : null

  const nodesByRow = useMemo(() => {
    const groups: Record<number, QuestNode[]> = {}
    for (const node of Object.values(act.nodes) as QuestNode[]) {
      if (!groups[node.row]) groups[node.row] = []
      groups[node.row].push(node)
    }
    for (const group of Object.values(groups)) {
      group.sort((a, b) => a.col - b.col)
    }
    return groups
  }, [act.nodes])

  const sortedRows = useMemo(
    () => Object.keys(nodesByRow).map(Number).sort((a, b) => a - b),
    [nodesByRow]
  )

  const filteredCards = useMemo(() => {
    const q = deckSearch.trim().toLowerCase()
    if (!q) return allCards.slice(0, 60)
    return allCards.filter(c => c.name.toLowerCase().includes(q)).slice(0, 60)
  }, [allCards, deckSearch])

  useEffect(() => {
    setNodeIdInput(selectedNode?.id ?? '')
  }, [selectedNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3500)
  }

  function handleActChange(newId: string) {
    setActId(newId)
    setAct(JSON.parse(JSON.stringify(ACTS[newId])))
    setSelectedNodeId(null)
    setDeckSearch('')
  }

  function updateActField<K extends keyof Act>(field: K, value: Act[K]) {
    setAct(prev => ({ ...prev, [field]: value }))
  }

  function updateNode(nodeId: string, patch: Partial<QuestNode>) {
    setAct(prev => ({
      ...prev,
      nodes: { ...prev.nodes, [nodeId]: { ...prev.nodes[nodeId], ...patch } },
    }))
  }

  function handleNodeIdBlur() {
    if (!selectedNodeId) return
    const newId = nodeIdInput.trim()
    if (!newId || newId === selectedNodeId) return
    if (act.nodes[newId]) {
      flash('Node ID already exists.')
      setNodeIdInput(selectedNodeId)
      return
    }
    const oldId = selectedNodeId
    const updatedNodes: Record<string, QuestNode> = {}
    for (const [key, n] of Object.entries(act.nodes) as [string, QuestNode][]) {
      if (key === oldId) continue
      updatedNodes[key] = {
        ...n,
        parentIds: n.parentIds.map(id => id === oldId ? newId : id),
        childIds:  n.childIds.map(id => id === oldId ? newId : id),
      }
    }
    updatedNodes[newId] = { ...act.nodes[oldId], id: newId }
    const startNodeIds = act.startNodeIds.map(id => id === oldId ? newId : id)
    setAct(prev => ({ ...prev, nodes: updatedNodes, startNodeIds }))
    setSelectedNodeId(newId)
  }

  function handleMoveNodeRow(nodeId: string, delta: -1 | 1) {
    const node = act.nodes[nodeId]
    const newRow = Math.max(0, node.row + delta)
    if (newRow === node.row) return
    const updated = recalculateCols({ ...act.nodes, [nodeId]: { ...node, row: newRow } })
    setAct(prev => ({ ...prev, nodes: updated }))
  }

  function handleAddNode() {
    const maxRow = sortedRows.length > 0 ? Math.max(...sortedRows) + 1 : 0
    const newId = `node-${Date.now()}`
    const newNode: QuestNode = {
      id: newId,
      type: 'battle',
      label: 'New Node',
      description: '',
      row: maxRow,
      col: 0,
      rowCols: 1,
      parentIds: [],
      childIds: [],
    }
    const updated = recalculateCols({ ...act.nodes, [newId]: newNode })
    setAct(prev => ({ ...prev, nodes: updated }))
    setSelectedNodeId(newId)
  }

  function handleDeleteNode(nodeId: string) {
    const { [nodeId]: _removed, ...rest } = act.nodes
    const cleaned: Record<string, QuestNode> = Object.fromEntries(
      (Object.entries(rest) as [string, QuestNode][]).map(([k, n]) => [k, {
        ...n,
        parentIds: n.parentIds.filter(id => id !== nodeId),
        childIds:  n.childIds.filter(id => id !== nodeId),
      }])
    )
    const updated = recalculateCols(cleaned)
    setAct(prev => ({
      ...prev,
      nodes: updated,
      startNodeIds: prev.startNodeIds.filter(id => id !== nodeId),
    }))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    flash(`Deleted "${nodeId}".`)
  }

  function addCardToDeck(cardName: string) {
    if (!selectedNodeId) return
    const deck = [...(act.nodes[selectedNodeId].enemyDeck ?? []), cardName]
    updateNode(selectedNodeId, { enemyDeck: deck })
  }

  function removeCardFromDeck(idx: number) {
    if (!selectedNodeId) return
    const deck = [...(act.nodes[selectedNodeId].enemyDeck ?? [])]
    deck.splice(idx, 1)
    updateNode(selectedNodeId, { enemyDeck: deck })
  }

  function moveCardInDeck(idx: number, delta: -1 | 1) {
    if (!selectedNodeId) return
    const deck = [...(act.nodes[selectedNodeId].enemyDeck ?? [])]
    const newIdx = idx + delta
    if (newIdx < 0 || newIdx >= deck.length) return
    ;[deck[idx], deck[newIdx]] = [deck[newIdx], deck[idx]]
    updateNode(selectedNodeId, { enemyDeck: deck })
  }

  function handleDownload() {
    const json = JSON.stringify(act, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${act.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    flash(`Downloaded ${act.id}.json`)
  }

  const isBattleType = selectedNode && ['battle', 'elite', 'boss'].includes(selectedNode.type)
  const isBossType = selectedNode?.type === 'boss'

  return (
    <OverlayScreen title="CAMPAIGN EDITOR" onBack={onBack} className="settings-screen">
      <div className="settings-body">

        {/* Flash message */}
        {msg && (
          <div className="settings-row">
            <div className="settings-sublabel" style={{ color: '#33ff33' }}>{msg}</div>
          </div>
        )}

        {/* Act selector */}
        <div className="settings-row">
          <div className="settings-label">Act</div>
          <select
            className="settings-select"
            value={actId}
            onChange={e => handleActChange(e.target.value)}
          >
            {ACT_IDS.map(id => (
              <option key={id} value={id}>
                {id} — {ACTS[id]?.title ?? id}
              </option>
            ))}
          </select>
        </div>

        {/* Act info */}
        <Section bordered title="ACT INFO">
          <div className="settings-row">
            <div className="settings-label">Title</div>
            <input
              className="settings-text-input"
              value={act.title}
              onChange={e => updateActField('title', e.target.value)}
            />
          </div>
          <div className="settings-row">
            <div className="settings-label">Subtitle</div>
            <input
              className="settings-text-input"
              value={act.subtitle}
              onChange={e => updateActField('subtitle', e.target.value)}
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Environment</div>
              <div className="settings-sublabel">Default battlefield for this act</div>
            </div>
            <select
              className="settings-select"
              value={act.environment ?? ''}
              onChange={e => updateActField('environment', e.target.value || undefined)}
            >
              <option value="">— none —</option>
              {ENVIRONMENTS.map(env => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-label">Reward relic</div>
            <input
              className="settings-text-input"
              value={act.rewardRelic}
              onChange={e => updateActField('rewardRelic', e.target.value)}
            />
          </div>
          <div className="settings-row">
            <div className="settings-label">Relic description</div>
            <input
              className="settings-text-input"
              value={act.rewardRelicDesc}
              onChange={e => updateActField('rewardRelicDesc', e.target.value)}
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Start node IDs</div>
              <div className="settings-sublabel">Comma-separated</div>
            </div>
            <input
              className="settings-text-input"
              value={act.startNodeIds.join(', ')}
              onChange={e =>
                updateActField(
                  'startNodeIds',
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )
              }
            />
          </div>
        </Section>

        {/* Nodes list */}
        <Section bordered title="NODES">
          <div className="settings-row">
            <button
              className="action-btn action-btn--gold action-btn--sm"
              onClick={handleAddNode}
            >
              + ADD NODE
            </button>
            <div className="settings-sublabel">
              {Object.keys(act.nodes).length} nodes total
            </div>
          </div>

          {sortedRows.map(row => (
            <div key={row} style={{ marginBottom: '8px' }}>
              <div
                className="settings-sublabel"
                style={{ color: '#555', marginBottom: '4px', fontSize: '11px', letterSpacing: '0.05em' }}
              >
                ROW {row}
              </div>
              {nodesByRow[row].map(node => (
                <div
                  key={node.id}
                  className="settings-row"
                  style={{
                    padding: '4px 6px',
                    background: selectedNodeId === node.id
                      ? 'rgba(51,255,51,0.07)'
                      : 'transparent',
                    border: selectedNodeId === node.id
                      ? '1px solid rgba(51,255,51,0.25)'
                      : '1px solid transparent',
                    borderRadius: '3px',
                    marginBottom: '2px',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.55 }}>
                      {node.id}
                    </span>
                    {' '}
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.4 }}>
                      [{node.type}]
                    </span>
                    {' '}
                    <span style={{ fontSize: '13px' }}>{node.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      className="action-btn action-btn--xs"
                      onClick={() =>
                        setSelectedNodeId(selectedNodeId === node.id ? null : node.id)
                      }
                    >
                      {selectedNodeId === node.id ? 'CLOSE' : 'EDIT'}
                    </button>
                    <button
                      className="action-btn action-btn--xs"
                      title="Move to earlier row"
                      onClick={() => handleMoveNodeRow(node.id, -1)}
                      disabled={node.row === 0}
                    >
                      ▲
                    </button>
                    <button
                      className="action-btn action-btn--xs"
                      title="Move to later row"
                      onClick={() => handleMoveNodeRow(node.id, 1)}
                    >
                      ▼
                    </button>
                    <button
                      className="action-btn action-btn--danger action-btn--xs"
                      onClick={() => handleDeleteNode(node.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {sortedRows.length === 0 && (
            <div className="settings-row">
              <div className="settings-sublabel">No nodes yet.</div>
            </div>
          )}
        </Section>

        {/* Node editor */}
        {selectedNode && (
          <Section bordered title={`NODE: ${selectedNode.id}`}>

            {/* ID */}
            <div className="settings-row">
              <div>
                <div className="settings-label">ID</div>
                <div className="settings-sublabel">Blur to rename — updates all refs</div>
              </div>
              <input
                className="settings-text-input"
                value={nodeIdInput}
                onChange={e => setNodeIdInput(e.target.value)}
                onBlur={handleNodeIdBlur}
              />
            </div>

            {/* Type */}
            <div className="settings-row">
              <div className="settings-label">Type</div>
              <select
                className="settings-select"
                value={selectedNode.type}
                onChange={e => updateNode(selectedNode.id, { type: e.target.value as NodeType })}
              >
                {NODE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div className="settings-row">
              <div className="settings-label">Label</div>
              <input
                className="settings-text-input"
                value={selectedNode.label}
                onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="settings-row">
              <div className="settings-label">Description</div>
              <input
                className="settings-text-input"
                value={selectedNode.description}
                onChange={e => updateNode(selectedNode.id, { description: e.target.value })}
              />
            </div>

            {/* Row / Col / RowCols */}
            <div className="settings-row">
              <div>
                <div className="settings-label">Row / Col / RowCols</div>
                <div className="settings-sublabel">▲▼ buttons auto-recalculate col</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  className="settings-number-input"
                  style={{ width: '60px' }}
                  value={selectedNode.row}
                  onChange={e => {
                    const newRow = Math.max(0, parseInt(e.target.value) || 0)
                    const updated = recalculateCols({
                      ...act.nodes,
                      [selectedNode.id]: { ...selectedNode, row: newRow },
                    })
                    setAct(prev => ({ ...prev, nodes: updated }))
                  }}
                />
                <input
                  type="number"
                  min={0}
                  className="settings-number-input"
                  style={{ width: '60px' }}
                  value={selectedNode.col}
                  onChange={e =>
                    updateNode(selectedNode.id, { col: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                />
                <input
                  type="number"
                  min={1}
                  className="settings-number-input"
                  style={{ width: '60px' }}
                  value={selectedNode.rowCols}
                  onChange={e =>
                    updateNode(selectedNode.id, { rowCols: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </div>
            </div>

            {/* Parent IDs */}
            <div className="settings-row">
              <div>
                <div className="settings-label">Parent IDs</div>
                <div className="settings-sublabel">Comma-separated</div>
              </div>
              <input
                className="settings-text-input"
                value={selectedNode.parentIds.join(', ')}
                onChange={e =>
                  updateNode(selectedNode.id, {
                    parentIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>

            {/* Child IDs */}
            <div className="settings-row">
              <div>
                <div className="settings-label">Child IDs</div>
                <div className="settings-sublabel">Comma-separated</div>
              </div>
              <input
                className="settings-text-input"
                value={selectedNode.childIds.join(', ')}
                onChange={e =>
                  updateNode(selectedNode.id, {
                    childIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>

            {/* ── Battle / Elite / Boss fields ─────────────────────── */}
            {isBattleType && (
              <>
                <div
                  className="settings-row"
                  style={{
                    marginTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    paddingTop: '10px',
                  }}
                >
                  <div
                    className="settings-sublabel"
                    style={{ color: 'var(--game-text-color)', fontWeight: 'bold', letterSpacing: '0.05em' }}
                  >
                    BATTLE SETTINGS
                  </div>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">Handicap</div>
                    <div className="settings-sublabel">0 = full strength · 7 = easiest</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    className="settings-number-input"
                    style={{ width: '70px' }}
                    value={selectedNode.handicap ?? 0}
                    onChange={e =>
                      updateNode(selectedNode.id, {
                        handicap: Math.max(0, Math.min(7, parseInt(e.target.value) || 0)),
                      })
                    }
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">Opponent interval (ms)</div>
                    <div className="settings-sublabel">Override AI play speed</div>
                  </div>
                  <input
                    type="number"
                    min={500}
                    className="settings-number-input"
                    style={{ width: '90px' }}
                    value={selectedNode.opponentIntervalMs ?? ''}
                    placeholder="default"
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      updateNode(selectedNode.id, {
                        opponentIntervalMs: isNaN(val) ? undefined : val,
                      })
                    }}
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">Opponent base HP</div>
                    <div className="settings-sublabel">Override opponent starting HP</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    className="settings-number-input"
                    style={{ width: '90px' }}
                    value={selectedNode.opponentBaseHp ?? ''}
                    placeholder="default"
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      updateNode(selectedNode.id, {
                        opponentBaseHp: isNaN(val) ? undefined : val,
                      })
                    }}
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">Environment</div>
                    <div className="settings-sublabel">Override act default</div>
                  </div>
                  <select
                    className="settings-select"
                    value={selectedNode.environment ?? ''}
                    onChange={e =>
                      updateNode(selectedNode.id, { environment: e.target.value || undefined })
                    }
                  >
                    <option value="">— inherit act default —</option>
                    {ENVIRONMENTS.map(env => (
                      <option key={env} value={env}>{env}</option>
                    ))}
                  </select>
                </div>

                {/* Enemy deck */}
                <div
                  className="settings-row"
                  style={{
                    marginTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    paddingTop: '10px',
                  }}
                >
                  <div
                    className="settings-sublabel"
                    style={{ color: 'var(--game-text-color)', fontWeight: 'bold', letterSpacing: '0.05em' }}
                  >
                    ENEMY DECK ({selectedNode.enemyDeck?.length ?? 0} cards)
                  </div>
                </div>

                {(selectedNode.enemyDeck ?? []).map((cardName, idx) => (
                  <div key={idx} className="settings-row" style={{ padding: '2px 0', gap: '4px' }}>
                    <span
                      style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', opacity: 0.85 }}
                    >
                      {idx + 1}. {cardName}
                    </span>
                    <button
                      className="action-btn action-btn--xs"
                      onClick={() => moveCardInDeck(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="action-btn action-btn--xs"
                      onClick={() => moveCardInDeck(idx, 1)}
                      disabled={idx === (selectedNode.enemyDeck?.length ?? 0) - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="action-btn action-btn--danger action-btn--xs"
                      onClick={() => removeCardFromDeck(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <div className="settings-row" style={{ marginTop: '6px' }}>
                  <div>
                    <div className="settings-label">Add card</div>
                    <div className="settings-sublabel">Search, then click to append</div>
                  </div>
                  <input
                    className="settings-text-input"
                    placeholder="search cards…"
                    value={deckSearch}
                    onChange={e => setDeckSearch(e.target.value)}
                    style={{ width: '160px' }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginBottom: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '3px',
                    padding: '4px',
                  }}
                >
                  {filteredCards.map(card => (
                    <div
                      key={card.name}
                      onClick={() => addCardToDeck(card.name)}
                      style={{
                        padding: '3px 8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        borderRadius: '2px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.background = 'rgba(51,255,51,0.1)')
                      }
                      onMouseLeave={e =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <span>{card.name}</span>
                      <span style={{ opacity: 0.45, fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {card.rarity} · {card.cardType}
                      </span>
                    </div>
                  ))}
                  {filteredCards.length === 0 && (
                    <div style={{ padding: '6px', fontSize: '12px', opacity: 0.5 }}>
                      No cards found.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Boss-specific fields ──────────────────────────────── */}
            {isBossType && (
              <>
                <div
                  className="settings-row"
                  style={{
                    marginTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    paddingTop: '10px',
                  }}
                >
                  <div
                    className="settings-sublabel"
                    style={{ color: 'var(--game-text-color)', fontWeight: 'bold', letterSpacing: '0.05em' }}
                  >
                    BOSS SETTINGS
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-label">Boss AI</div>
                  <input
                    className="settings-text-input"
                    value={selectedNode.bossAI ?? ''}
                    placeholder="e.g. thornlord"
                    onChange={e =>
                      updateNode(selectedNode.id, { bossAI: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">Boss card</div>
                    <div className="settings-sublabel">Deployed when opponent base falls</div>
                  </div>
                  <input
                    className="settings-text-input"
                    value={selectedNode.bossCard ?? ''}
                    placeholder="card name"
                    onChange={e =>
                      updateNode(selectedNode.id, { bossCard: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-label">Boss name</div>
                  <input
                    className="settings-text-input"
                    value={selectedNode.bossName ?? ''}
                    placeholder="display name override"
                    onChange={e =>
                      updateNode(selectedNode.id, { bossName: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">HP multiplier</div>
                    <div className="settings-sublabel">Applied to boss card HP (default 10)</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    className="settings-number-input"
                    style={{ width: '80px' }}
                    value={selectedNode.bossHpMultiplier ?? ''}
                    placeholder="10"
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      updateNode(selectedNode.id, {
                        bossHpMultiplier: isNaN(val) ? undefined : val,
                      })
                    }}
                  />
                </div>

                {/* Boss dialogue */}
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Boss dialogue</div>
                    <div className="settings-sublabel">Pre-battle lines</div>
                  </div>
                  <button
                    className="action-btn action-btn--xs"
                    onClick={() =>
                      updateNode(selectedNode.id, {
                        bossDialogue: [...(selectedNode.bossDialogue ?? []), ''],
                      })
                    }
                  >
                    + LINE
                  </button>
                </div>
                {(selectedNode.bossDialogue ?? []).map((line, idx) => (
                  <div key={idx} className="settings-row" style={{ gap: '6px' }}>
                    <input
                      className="settings-text-input"
                      style={{ flex: 1 }}
                      value={line}
                      onChange={e => {
                        const lines = [...(selectedNode.bossDialogue ?? [])]
                        lines[idx] = e.target.value
                        updateNode(selectedNode.id, { bossDialogue: lines })
                      }}
                    />
                    <button
                      className="action-btn action-btn--danger action-btn--xs"
                      onClick={() => {
                        const lines = (selectedNode.bossDialogue ?? []).filter(
                          (_, i) => i !== idx
                        )
                        updateNode(selectedNode.id, {
                          bossDialogue: lines.length ? lines : undefined,
                        })
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ── Rest-specific fields ──────────────────────────────── */}
            {selectedNode.type === 'rest' && (
              <>
                <div
                  className="settings-row"
                  style={{
                    marginTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    paddingTop: '10px',
                  }}
                >
                  <div
                    className="settings-sublabel"
                    style={{ color: 'var(--game-text-color)', fontWeight: 'bold', letterSpacing: '0.05em' }}
                  >
                    REST SETTINGS
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Heal amount</div>
                    <div className="settings-sublabel">HP restored (default 5)</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    className="settings-number-input"
                    style={{ width: '80px' }}
                    value={selectedNode.restHeal ?? ''}
                    placeholder="5"
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      updateNode(selectedNode.id, {
                        restHeal: isNaN(val) ? undefined : val,
                      })
                    }}
                  />
                </div>
              </>
            )}

          </Section>
        )}

        {/* Export */}
        <Section bordered title="EXPORT">
          <div className="settings-row">
            <div>
              <div className="settings-label">Download {actId}.json</div>
              <div className="settings-sublabel">
                Save the edited act file, then commit it to the repo
              </div>
            </div>
            <button className="action-btn action-btn--gold" onClick={handleDownload}>
              DOWNLOAD
            </button>
          </div>
        </Section>

      </div>
    </OverlayScreen>
  )
}
