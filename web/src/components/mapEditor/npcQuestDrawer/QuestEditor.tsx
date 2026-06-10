import React, { useState, useEffect } from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import type { QuestDefinition, QuestStep, QuestReward, Dialogue } from '../../../data/hub/questDefs'
import { isQuestIdUnique, generateQuestId } from './questValidation'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
}
const SELECT: React.CSSProperties = { ...INPUT }
const NUM: React.CSSProperties = {
  width: 56, padding: '3px 5px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11,
}
const BTN_DANGER: React.CSSProperties = {
  padding: '2px 7px', background: '#5a1a1a', border: '1px solid #922',
  color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer',
}
const BTN_ADD: React.CSSProperties = {
  padding: '3px 10px', background: '#1e2e1e', border: '1px solid #3a5a3a',
  color: '#6d6', borderRadius: 3, fontSize: 11, cursor: 'pointer',
}
const BTN_APPLY: React.CSSProperties = {
  padding: '4px 12px', background: '#1a3a5a', border: '1px solid #3a7aaa',
  color: '#7af', borderRadius: 3, fontSize: 11, cursor: 'pointer', fontWeight: 'bold',
}
const BTN_DISCARD: React.CSSProperties = {
  padding: '4px 10px', background: '#2a2a2a', border: '1px solid #444',
  color: '#aaa', borderRadius: 3, fontSize: 11, cursor: 'pointer',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: error ? '#f88' : '#888', fontSize: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}{error && ` — ${error}`}
      </div>
      {children}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function syncChainDialogue(dialogue: string | Dialogue, steps: QuestStep[]): Dialogue {
  const existing = typeof dialogue === 'object' && dialogue !== null ? dialogue : {}
  const result: Dialogue = {}
  for (const step of steps) {
    result[step.key] = (existing as Record<string, string | undefined>)[step.key] ?? ''
  }
  return result
}

function normalizeQuestReceive(cur: RawNpc['questReceive']): string[] {
  return Array.isArray(cur) ? cur : cur ? [cur] : []
}

function packQuestReceive(arr: string[]): RawNpc['questReceive'] {
  return arr.length === 0 ? undefined : arr.length === 1 ? arr[0] : arr
}

function applyNpcQuestSync(
  draft: QuestDefinition,
  original: QuestDefinition | null,
  npcs: RawNpc[],
  updateNpc: (i: number, partial: Partial<RawNpc>) => void,
) {
  const questId = draft.id

  if (!original || original.giverNpcId !== draft.giverNpcId) {
    if (original) {
      const oldIdx = npcs.findIndex(n => n.id === original.giverNpcId)
      if (oldIdx >= 0 && npcs[oldIdx].questGive === questId) {
        updateNpc(oldIdx, { questGive: undefined })
      }
    }
    const newIdx = npcs.findIndex(n => n.id === draft.giverNpcId)
    if (newIdx >= 0) updateNpc(newIdx, { questGive: questId })
  }

  const origReceiver = original?.receiverNpcId ?? ''
  if (!original || origReceiver !== (draft.receiverNpcId ?? '')) {
    if (original && origReceiver) {
      const oldIdx = npcs.findIndex(n => n.id === origReceiver)
      if (oldIdx >= 0) {
        const filtered = normalizeQuestReceive(npcs[oldIdx].questReceive).filter(q => q !== questId)
        updateNpc(oldIdx, { questReceive: packQuestReceive(filtered) })
      }
    }
    if (draft.receiverNpcId) {
      const newIdx = npcs.findIndex(n => n.id === draft.receiverNpcId)
      if (newIdx >= 0) {
        const arr = normalizeQuestReceive(npcs[newIdx].questReceive)
        if (!arr.includes(questId)) {
          updateNpc(newIdx, { questReceive: packQuestReceive([...arr, questId]) })
        }
      }
    }
  }
}

function cleanupNpcLinksOnDelete(
  questId: string,
  npcs: RawNpc[],
  updateNpc: (i: number, partial: Partial<RawNpc>) => void,
) {
  npcs.forEach((npc, i) => {
    const partial: Partial<RawNpc> = {}
    if (npc.questGive === questId) partial.questGive = undefined
    const arr = normalizeQuestReceive(npc.questReceive)
    if (arr.includes(questId)) partial.questReceive = packQuestReceive(arr.filter(q => q !== questId))
    if (Object.keys(partial).length > 0) updateNpc(i, partial)
  })
}

function makeEmptyQuest(existingIds: string[]): QuestDefinition {
  return {
    id: generateQuestId(existingIds),
    title: 'New Quest',
    type: 'fetch',
    giverNpcId: '',
    receiverNpcId: '',
    offerDialogue: '',
    activeDialogue: '',
    completeDialogue: '',
    steps: [],
    reward: {},
  }
}

// ── StepsEditor ───────────────────────────────────────────────────────────────

function StepsEditor({ steps, onChange }: { steps: QuestStep[]; onChange: (s: QuestStep[]) => void }) {
  function update(i: number, partial: Partial<QuestStep>) {
    onChange(steps.map((s, j) => j === i ? { ...s, ...partial } as QuestStep : s))
  }

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} style={{ background: '#1a2030', border: '1px solid #2a3050', borderRadius: 3, padding: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input type="text" placeholder="key" value={step.key}
              onChange={e => update(i, { key: e.target.value })}
              style={{ width: 80, padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
            <select
              value={step.type}
              onChange={e => {
                const type = e.target.value as 'collect' | 'deliver'
                if (type === 'collect') update(i, { type, pickupIds: (step as { pickupIds?: string[] }).pickupIds ?? [], targetNpcId: undefined })
                else update(i, { type, targetNpcId: '', pickupIds: undefined })
              }}
              style={{ padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10 }}
            >
              <option value="collect">collect</option>
              <option value="deliver">deliver</option>
            </select>
            <label style={{ color: '#888', fontSize: 10 }}>req</label>
            <input type="number" value={step.required} min={1}
              onChange={e => update(i, { required: Number(e.target.value) })}
              style={{ ...NUM, width: 44 }} />
            <button style={{ ...BTN_DANGER, marginLeft: 'auto' }} onClick={() => onChange(steps.filter((_, j) => j !== i))}>✕</button>
          </div>
          {step.type === 'collect' && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ color: '#666', fontSize: 10, marginBottom: 2 }}>pickupIds (one per line)</div>
              <textarea rows={2} value={((step as { pickupIds?: string[] }).pickupIds ?? []).join('\n')}
                onChange={e => update(i, { pickupIds: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) } as Partial<QuestStep>)}
                style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
          )}
          {step.type === 'deliver' && (
            <input type="text" placeholder="targetNpcId"
              value={(step as { targetNpcId?: string }).targetNpcId ?? ''}
              onChange={e => update(i, { targetNpcId: e.target.value } as Partial<QuestStep>)}
              style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }} />
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <label style={{ color: '#666', fontSize: 10 }}>chain (unlock after):</label>
            <input type="text" placeholder="pickupId or empty"
              value={(step as { chain?: string }).chain ?? ''}
              onChange={e => update(i, { chain: e.target.value || undefined } as Partial<QuestStep>)}
              style={{ flex: 1, padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10 }} />
          </div>
        </div>
      ))}
      <button style={BTN_ADD} onClick={() => onChange([...steps, { key: `step-${steps.length + 1}`, type: 'collect', pickupIds: [], required: 1 }])}>
        + Add step
      </button>
    </div>
  )
}

// ── RewardEditor ──────────────────────────────────────────────────────────────

function FriendshipEditor({ friendship, onChange }: { friendship: Record<string, number>; onChange: (f: Record<string, number>) => void }) {
  const entries = Object.entries(friendship)
  return (
    <div>
      {entries.map(([npcId, amount], i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
          <input type="text" value={npcId} placeholder="npcId"
            onChange={e => {
              const updated: Record<string, number> = {}
              entries.forEach(([k, v], j) => { updated[j === i ? e.target.value : k] = v })
              onChange(updated)
            }}
            style={{ flex: 1, padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
          <input type="number" value={amount}
            onChange={e => onChange({ ...friendship, [npcId]: Number(e.target.value) })}
            style={{ ...NUM, width: 48 }} />
          <button style={BTN_DANGER}
            onClick={() => { const f = { ...friendship }; delete f[npcId]; onChange(f) }}>✕</button>
        </div>
      ))}
      <button style={{ ...BTN_ADD, fontSize: 10, padding: '2px 8px' }}
        onClick={() => onChange({ ...friendship, '': 10 })}>+ Add</button>
    </div>
  )
}

function RewardEditor({ reward, onChange }: { reward: QuestReward; onChange: (r: QuestReward) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <label style={{ color: '#888', fontSize: 10 }}>Crystals</label>
        <input type="number" value={reward.crystals ?? 0} min={0}
          onChange={e => onChange({ ...reward, crystals: Number(e.target.value) || undefined })}
          style={{ ...NUM, width: 60 }} />
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ color: '#888', fontSize: 10, marginBottom: 3 }}>FRIENDSHIP</div>
        <FriendshipEditor
          friendship={reward.friendship as Record<string, number> ?? {}}
          onChange={f => onChange({ ...reward, friendship: Object.keys(f).length > 0 ? f : undefined })} />
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#888', fontSize: 10 }}>COLLECTIBLE</span>
          {reward.collectible
            ? <button style={{ ...BTN_DANGER, padding: '1px 6px' }} onClick={() => onChange({ ...reward, collectible: undefined })}>✕ Remove</button>
            : <button style={{ ...BTN_ADD, fontSize: 10, padding: '1px 8px' }} onClick={() => onChange({ ...reward, collectible: { id: '', name: '', icon: '🎁', desc: '' } })}>+ Add</button>
          }
        </div>
        {reward.collectible && (
          <div style={{ background: '#1a1a30', borderRadius: 3, padding: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {(['id', 'name', 'icon', 'desc'] as const).map(k => (
              <div key={k}>
                <div style={{ color: '#666', fontSize: 9, marginBottom: 2 }}>{k}</div>
                <input type="text" value={reward.collectible![k]}
                  onChange={e => onChange({ ...reward, collectible: { ...reward.collectible!, [k]: e.target.value } })}
                  style={{ width: '100%', padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label style={{ color: '#888', fontSize: 10 }}>UNLOCK</label>
        <input type="text" placeholder="unlock id (optional)" value={reward.unlock ?? ''}
          onChange={e => onChange({ ...reward, unlock: e.target.value || undefined })}
          style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
      </div>
    </div>
  )
}

// ── QuestFullEditor ───────────────────────────────────────────────────────────

function QuestFullEditor({
  quest, allQuests, npcIds, onApply, onDiscard,
}: {
  quest: QuestDefinition
  allQuests: QuestDefinition[]
  npcIds: string[]
  onApply: (updated: QuestDefinition) => void
  onDiscard: () => void
}) {
  const [draft, setDraft] = useState<QuestDefinition>(() => ({ ...quest }))
  useEffect(() => { setDraft({ ...quest }) }, [quest])

  const questIndex = allQuests.findIndex(q => q.id === quest.id)
  const idError = !isQuestIdUnique(draft.id, allQuests, questIndex) ? 'ID already exists' : undefined

  const isChain = draft.type === 'chain'
  const activeDialogue = draft.activeDialogue

  function set<K extends keyof QuestDefinition>(key: K, value: QuestDefinition[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function setType(type: string) {
    setDraft(d => ({
      ...d,
      type,
      activeDialogue: type === 'chain'
        ? syncChainDialogue(d.activeDialogue, d.steps)
        : typeof d.activeDialogue === 'object' ? '' : d.activeDialogue,
    }))
  }

  function setSteps(steps: QuestStep[]) {
    setDraft(d => ({
      ...d,
      steps,
      activeDialogue: d.type === 'chain' ? syncChainDialogue(d.activeDialogue, steps) : d.activeDialogue,
    }))
  }

  const prerequisiteOptions = [
    { value: '', label: '— none —' },
    ...allQuests.filter(q => q.id !== draft.id).map(q => ({ value: q.id, label: q.id })),
  ]

  return (
    <div style={{ padding: '8px 10px 12px', borderLeft: '3px solid #7a6aae', marginLeft: 4, marginBottom: 6 }}>
      <Field label="ID" error={idError}>
        <input style={{ ...INPUT, borderColor: idError ? '#922' : '#444' }} type="text" value={draft.id}
          onChange={e => set('id', e.target.value)} />
      </Field>
      <Field label="Title">
        <input style={INPUT} type="text" value={draft.title} onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="Type">
        <select style={SELECT} value={draft.type} onChange={e => setType(e.target.value)}>
          <option value="fetch">fetch</option>
          <option value="chain">chain</option>
          <option value="lost-items">lost-items</option>
        </select>
      </Field>
      <Field label="Giver NPC">
        <select style={SELECT} value={draft.giverNpcId} onChange={e => set('giverNpcId', e.target.value)}>
          <option value="">— none —</option>
          {npcIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </Field>
      <Field label="Receiver NPC">
        <select style={SELECT} value={draft.receiverNpcId ?? ''} onChange={e => set('receiverNpcId', e.target.value)}>
          <option value="">— none —</option>
          {npcIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </Field>
      <Field label="Prerequisite">
        <select style={SELECT} value={draft.prerequisite ?? ''} onChange={e => set('prerequisite', e.target.value || undefined)}>
          {prerequisiteOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Offer Dialogue">
        <textarea rows={2} value={typeof draft.offerDialogue === 'string' ? draft.offerDialogue : ''}
          onChange={e => set('offerDialogue', e.target.value)}
          style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
      </Field>
      <Field label={isChain ? 'Active Dialogue (per step key)' : 'Active Dialogue'}>
        {isChain ? (
          <div>
            {Object.entries(activeDialogue as Dialogue).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#888', minWidth: 60, paddingTop: 4 }}>{key}</span>
                <textarea rows={2} value={val ?? ''}
                  onChange={e => set('activeDialogue', { ...(activeDialogue as Dialogue), [key]: e.target.value })}
                  style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            ))}
            {Object.keys(activeDialogue as Dialogue).length === 0 && (
              <span style={{ color: '#555', fontSize: 11 }}>Add steps to configure per-step dialogue.</span>
            )}
          </div>
        ) : (
          <textarea rows={2} value={typeof activeDialogue === 'string' ? activeDialogue : ''}
            onChange={e => set('activeDialogue', e.target.value)}
            style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
        )}
      </Field>
      <Field label="Complete Dialogue">
        <textarea rows={2} value={typeof draft.completeDialogue === 'string' ? draft.completeDialogue : ''}
          onChange={e => set('completeDialogue', e.target.value)}
          style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
      </Field>
      <Field label="Steps">
        <StepsEditor steps={draft.steps} onChange={setSteps} />
      </Field>
      <Field label="Reward">
        <RewardEditor reward={draft.reward} onChange={r => set('reward', r)} />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button style={BTN_DISCARD} onClick={onDiscard}>Discard</button>
        <button style={{ ...BTN_APPLY, opacity: idError ? 0.5 : 1 }} disabled={!!idError}
          onClick={() => onApply(draft)}>
          Apply Changes
        </button>
      </div>
    </div>
  )
}

// ── QuestEditor (main export) ─────────────────────────────────────────────────

export function QuestEditor({ configData, questDefsData, onUpdateNpc, onQuestDefsChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const quests = (questDefsData.quests as QuestDefinition[] | undefined) ?? []
  const npcs = configData.npcs ?? []
  const npcIds = npcs.map(n => n.id)

  function handleApply(original: QuestDefinition, updated: QuestDefinition) {
    onQuestDefsChange(prev => {
      const prevQuests = (prev.quests as QuestDefinition[] | undefined) ?? []
      const newQuests = prevQuests.map(q => q.id === original.id ? updated : q)
      return { ...prev, quests: newQuests }
    })
    applyNpcQuestSync(updated, original, npcs, onUpdateNpc)
    if (updated.id !== original.id) setExpandedId(updated.id)
  }

  function handleAdd() {
    const newQuest = makeEmptyQuest(quests.map(q => q.id))
    onQuestDefsChange(prev => ({
      ...prev,
      quests: [...((prev.quests as QuestDefinition[] | undefined) ?? []), newQuest],
    }))
    setExpandedId(newQuest.id)
  }

  function handleDelete(questId: string) {
    onQuestDefsChange(prev => ({
      ...prev,
      quests: ((prev.quests as QuestDefinition[] | undefined) ?? []).filter(q => q.id !== questId),
    }))
    cleanupNpcLinksOnDelete(questId, npcs, onUpdateNpc)
    setExpandedId(null)
    setDeleteConfirmId(null)
  }

  const TYPE_COLOURS: Record<string, string> = { fetch: '#4a8', chain: '#a7f', 'lost-items': '#fa4' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 8, color: '#ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button style={BTN_ADD} onClick={handleAdd}>+ New Quest</button>
      </div>

      {quests.length === 0 && (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 20 }}>No quests on this map.</div>
      )}

      {quests.map(quest => (
        <div key={quest.id}>
          <div
            style={{
              padding: '5px 8px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              background: expandedId === quest.id ? '#2a2a4e' : '#1e1e3e',
              border: `1px solid ${expandedId === quest.id ? '#7a6aae' : '#2a2a4a'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}
              onClick={() => setExpandedId(expandedId === quest.id ? null : quest.id)}>
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 2,
                background: (TYPE_COLOURS[quest.type] ?? '#888') + '33',
                color: TYPE_COLOURS[quest.type] ?? '#888',
                border: `1px solid ${(TYPE_COLOURS[quest.type] ?? '#888')}55`,
                flexShrink: 0,
              }}>{quest.type}</span>
              <span style={{ fontWeight: expandedId === quest.id ? 'bold' : 'normal', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quest.title}</span>
              <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>{quest.id}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
              {deleteConfirmId === quest.id ? (
                <>
                  <span style={{ color: '#f88', fontSize: 10 }}>Delete?</span>
                  <button style={{ ...BTN_DANGER, padding: '2px 8px' }} onClick={() => handleDelete(quest.id)}>Yes</button>
                  <button style={BTN_DISCARD} onClick={() => setDeleteConfirmId(null)}>No</button>
                </>
              ) : (
                <button style={{ ...BTN_DANGER, padding: '1px 5px' }}
                  onClick={e => { e.stopPropagation(); setDeleteConfirmId(quest.id) }}>🗑</button>
              )}
              <span style={{ color: '#666', fontSize: 11 }}
                onClick={() => setExpandedId(expandedId === quest.id ? null : quest.id)}>
                {expandedId === quest.id ? '▾' : '▸'}
              </span>
            </div>
          </div>

          {expandedId === quest.id && (
            <QuestFullEditor
              quest={quest}
              allQuests={quests}
              npcIds={npcIds}
              onApply={updated => handleApply(quest, updated)}
              onDiscard={() => setExpandedId(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
