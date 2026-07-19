import React, { useState } from 'react'
import type { MapId, QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import type { RawMapConfig } from '../mapEditorTypes'
import { EntityRefPicker } from '../EntityRefPicker'
import { npcRefOptions, type RefOption } from '../entityRefs'

interface Props {
  mapId: MapId
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
}
const BTN_ADD: React.CSSProperties = {
  padding: '3px 10px', background: '#1e2e1e', border: '1px solid #3a5a3a',
  color: '#6d6', borderRadius: 3, fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start',
}
const BTN_X: React.CSSProperties = {
  padding: '1px 6px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer',
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 8, border: '1px solid #2a2a4a', borderRadius: 4 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '6px 8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: '#1a1a2e', color }}>
        <span style={{ fontSize: 12, fontWeight: 'bold' }}>{title}</span>
        <span style={{ color: '#666' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ padding: 8 }}>{children}</div>}
    </div>
  )
}

// friendshipDialogue: { npcId: { tier: line } }
function FriendshipEditor({ data, onChange, npcOptions }: { data: Record<string, Record<string, string>>; onChange: (d: Record<string, Record<string, string>>) => void; npcOptions: RefOption[] }) {
  const npcs = Object.entries(data)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {npcs.map(([npcId, tiers]) => (
        <div key={npcId} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 6 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <EntityRefPicker value={npcId} options={npcOptions} placeholder="Search NPC…" onChange={v => {
                const next = { ...data }; delete next[npcId]; next[v] = tiers; onChange(next)
              }} />
            </div>
            <button style={BTN_X} onClick={() => { const next = { ...data }; delete next[npcId]; onChange(next) }}>✕</button>
          </div>
          {Object.entries(tiers).map(([tier, line]) => (
            <div key={tier} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'flex-start' }}>
              <input style={{ ...INPUT, width: 40, flex: '0 0 40px' }} value={tier} onChange={e => {
                const nt = { ...tiers }; delete nt[tier]; nt[e.target.value] = line; onChange({ ...data, [npcId]: nt })
              }} />
              <textarea style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} rows={2} value={line} onChange={e => onChange({ ...data, [npcId]: { ...tiers, [tier]: e.target.value } })} />
              <button style={BTN_X} onClick={() => { const nt = { ...tiers }; delete nt[tier]; onChange({ ...data, [npcId]: nt }) }}>✕</button>
            </div>
          ))}
          <button style={{ ...BTN_ADD, fontSize: 10, padding: '1px 8px' }} onClick={() => onChange({ ...data, [npcId]: { ...tiers, '2': '' } })}>+ tier line</button>
        </div>
      ))}
      <button style={BTN_ADD} onClick={() => onChange({ ...data, '': {} })}>+ Add NPC</button>
    </div>
  )
}

// relationshipDialogue: { npcId: { relType: { tier: line } } }
function RelationshipEditor({ data, onChange, npcOptions }: { data: Record<string, Record<string, Record<string, string>>>; onChange: (d: Record<string, Record<string, Record<string, string>>>) => void; npcOptions: RefOption[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(data).map(([npcId, rels]) => (
        <div key={npcId} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 6 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <EntityRefPicker value={npcId} options={npcOptions} placeholder="Search NPC…" onChange={v => { const next = { ...data }; delete next[npcId]; next[v] = rels; onChange(next) }} />
            </div>
            <button style={BTN_X} onClick={() => { const next = { ...data }; delete next[npcId]; onChange(next) }}>✕</button>
          </div>
          {Object.entries(rels).map(([relType, tiers]) => (
            <div key={relType} style={{ marginLeft: 6, marginBottom: 4, borderLeft: '2px solid #3a3a5a', paddingLeft: 6 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                <input style={{ ...INPUT, width: 80, flex: '0 0 80px' }} value={relType} onChange={e => { const nr = { ...rels }; delete nr[relType]; nr[e.target.value] = tiers; onChange({ ...data, [npcId]: nr }) }} />
                <button style={BTN_X} onClick={() => { const nr = { ...rels }; delete nr[relType]; onChange({ ...data, [npcId]: nr }) }}>✕</button>
              </div>
              {Object.entries(tiers).map(([tier, line]) => (
                <div key={tier} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                  <input style={{ ...INPUT, width: 36, flex: '0 0 36px' }} value={tier} onChange={e => { const nt = { ...tiers }; delete nt[tier]; nt[e.target.value] = line; onChange({ ...data, [npcId]: { ...rels, [relType]: nt } }) }} />
                  <textarea style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} rows={2} value={line} onChange={e => onChange({ ...data, [npcId]: { ...rels, [relType]: { ...tiers, [tier]: e.target.value } } })} />
                </div>
              ))}
              <button style={{ ...BTN_ADD, fontSize: 10, padding: '1px 8px' }} onClick={() => onChange({ ...data, [npcId]: { ...rels, [relType]: { ...tiers, '2': '' } } })}>+ tier</button>
            </div>
          ))}
          <button style={{ ...BTN_ADD, fontSize: 10, padding: '1px 8px' }} onClick={() => onChange({ ...data, [npcId]: { ...rels, ally: {} } })}>+ relationship</button>
        </div>
      ))}
      <button style={BTN_ADD} onClick={() => onChange({ ...data, '': {} })}>+ Add NPC</button>
    </div>
  )
}

// dialogues: [{ id, npcId, start, nodes }] — fields + JSON node editor.
function DialogueTreeRow({ dlg, onChange, onDelete, npcOptions }: { dlg: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; onDelete: () => void; npcOptions: RefOption[] }) {
  const [nodesText, setNodesText] = useState(() => JSON.stringify(dlg.nodes ?? {}, null, 1))
  const [err, setErr] = useState('')
  return (
    <div style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 6, marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input style={INPUT} placeholder="id" value={String(dlg.id ?? '')} onChange={e => onChange({ ...dlg, id: e.target.value })} />
        <div style={{ flex: 1 }}>
          <EntityRefPicker value={String(dlg.npcId ?? '')} options={npcOptions} placeholder="npcId…" onChange={v => onChange({ ...dlg, npcId: v })} />
        </div>
        <input style={{ ...INPUT, width: 70, flex: '0 0 70px' }} placeholder="start" value={String(dlg.start ?? '')} onChange={e => onChange({ ...dlg, start: e.target.value })} />
        <button style={BTN_X} onClick={onDelete}>✕</button>
      </div>
      <div style={{ color: '#888', fontSize: 9, marginBottom: 2 }}>Nodes (JSON)</div>
      <textarea
        style={{ ...INPUT, resize: 'vertical', fontFamily: 'monospace', borderColor: err ? '#922' : '#444' }}
        rows={6}
        value={nodesText}
        onChange={e => {
          setNodesText(e.target.value)
          try { const parsed = JSON.parse(e.target.value); setErr(''); onChange({ ...dlg, nodes: parsed }) }
          catch (ex) { setErr(ex instanceof Error ? ex.message : 'invalid JSON') }
        }}
      />
      {err && <div style={{ color: '#f88', fontSize: 9 }}>{err}</div>}
    </div>
  )
}

export function DialogueEditor({ mapId, configData, questDefsData, onQuestDefsChange }: Props) {
  const q = questDefsData as unknown as Record<string, unknown>
  const friendship = (q.friendshipDialogue as Record<string, Record<string, string>>) ?? {}
  const relationship = (q.relationshipDialogue as Record<string, Record<string, Record<string, string>>>) ?? {}
  const dialogues = (q.dialogues as Array<Record<string, unknown>>) ?? []
  const npcOptions = npcRefOptions(mapId, configData.npcs ?? [], false)
  const patch = (key: string, value: unknown) => onQuestDefsChange(prev => ({ ...(prev as object), [key]: value }) as QuestDefsJson)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 8, color: '#ccc' }}>
      <Section title={`Friendship Dialogue (${Object.keys(friendship).length})`} color="#88ffaa">
        <FriendshipEditor data={friendship} npcOptions={npcOptions} onChange={d => patch('friendshipDialogue', d)} />
      </Section>
      <Section title={`Relationship Dialogue (${Object.keys(relationship).length})`} color="#ffaa88">
        <RelationshipEditor data={relationship} npcOptions={npcOptions} onChange={d => patch('relationshipDialogue', d)} />
      </Section>
      <Section title={`Dialogue Trees (${dialogues.length})`} color="#88aaff">
        {dialogues.map((dlg, i) => (
          <DialogueTreeRow
            key={i}
            dlg={dlg}
            npcOptions={npcOptions}
            onChange={d => patch('dialogues', dialogues.map((x, j) => j === i ? d : x))}
            onDelete={() => patch('dialogues', dialogues.filter((_, j) => j !== i))}
          />
        ))}
        <button style={BTN_ADD} onClick={() => patch('dialogues', [...dialogues, { id: '', npcId: '', start: 'greet', nodes: { greet: { text: '' } } }])}>+ Add dialogue tree</button>
      </Section>
    </div>
  )
}
