import React from 'react'
import { EntityRefPicker } from '../EntityRefPicker'
import type { RefOption } from '../entityRefs'

// Quest prerequisites are AND-combined conditions serialised in one string with
// `|` (see checkPrerequisite in HubWorld.tsx):
//   quest:<id> | friendship:<npc>:<level> | relationship:<npc>:<track>:<level>
// A bare token (no prefix, legacy / editor-written) is treated as a completed
// quest and re-serialised as `quest:<id>` — fixing prereqs that silently never
// gated.

const RELATIONSHIP_TRACKS = ['ally', 'rival', 'romance']

type Cond =
  | { type: 'quest'; questId: string }
  | { type: 'friendship'; npcId: string; level: number }
  | { type: 'relationship'; npcId: string; track: string; level: number }

function parse(str: string | undefined): Cond[] {
  if (!str) return []
  return str.split('|').map(s => s.trim()).filter(Boolean).map<Cond>(part => {
    if (part.startsWith('friendship:')) {
      const [, npcId = '', lvl = '1'] = part.split(':')
      return { type: 'friendship', npcId, level: Number(lvl) || 1 }
    }
    if (part.startsWith('relationship:')) {
      const [, npcId = '', track = 'ally', lvl = '1'] = part.split(':')
      return { type: 'relationship', npcId, track, level: Number(lvl) || 1 }
    }
    if (part.startsWith('quest:')) return { type: 'quest', questId: part.slice(6) }
    return { type: 'quest', questId: part }  // bare legacy id → quest condition
  })
}

function serialise(conds: Cond[]): string | undefined {
  // Drop incomplete rows (no quest / no npc picked yet) so we never write a
  // dangling `quest:` token.
  const clean = conds
    .filter(c => (c.type === 'quest' ? c.questId : c.npcId))
    .map(c =>
      c.type === 'quest' ? `quest:${c.questId}`
        : c.type === 'friendship' ? `friendship:${c.npcId}:${c.level}`
          : `relationship:${c.npcId}:${c.track}:${c.level}`,
    )
  return clean.length ? clean.join(' | ') : undefined
}

const SELECT: React.CSSProperties = {
  padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10,
}
const NUM: React.CSSProperties = {
  width: 40, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11,
}

/** Structured editor for a quest's `prerequisite` condition string. */
export function PrerequisiteEditor({ value, onChange, questOptions, npcOptions }: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  questOptions: RefOption[]
  npcOptions: RefOption[]
}) {
  const conds = parse(value)
  const setConds = (next: Cond[]) => onChange(serialise(next))
  const update = (i: number, c: Cond) => setConds(conds.map((x, j) => j === i ? c : x))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {conds.length === 0 && <span style={{ color: '#555', fontSize: 11 }}>No conditions — always available.</span>}
      {conds.map((c, i) => (
        <div key={i} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 5 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            <select style={SELECT} value={c.type} onChange={e => {
              const type = e.target.value
              update(i, type === 'quest' ? { type: 'quest', questId: '' }
                : type === 'friendship' ? { type: 'friendship', npcId: '', level: 2 }
                  : { type: 'relationship', npcId: '', track: 'ally', level: 2 })
            }}>
              <option value="quest">quest complete</option>
              <option value="friendship">friendship level</option>
              <option value="relationship">relationship level</option>
            </select>
            <button style={{ marginLeft: 'auto', padding: '1px 6px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
              onClick={() => setConds(conds.filter((_, j) => j !== i))}>✕</button>
          </div>
          {c.type === 'quest' && (
            <EntityRefPicker value={c.questId} options={questOptions} placeholder="Search quests (any town)…"
              onChange={v => update(i, { type: 'quest', questId: v })} />
          )}
          {c.type === 'friendship' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <EntityRefPicker value={c.npcId} options={npcOptions} placeholder="Search NPC…" onChange={v => update(i, { ...c, npcId: v })} />
              </div>
              <label style={{ fontSize: 9, color: '#888' }}>lvl</label>
              <input type="number" min={1} style={NUM} value={c.level} onChange={e => update(i, { ...c, level: Number(e.target.value) || 1 })} />
            </div>
          )}
          {c.type === 'relationship' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <EntityRefPicker value={c.npcId} options={npcOptions} placeholder="Search NPC…" onChange={v => update(i, { ...c, npcId: v })} />
              </div>
              <select style={SELECT} value={c.track} onChange={e => update(i, { ...c, track: e.target.value })}>
                {RELATIONSHIP_TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ fontSize: 9, color: '#888' }}>lvl</label>
              <input type="number" min={1} style={NUM} value={c.level} onChange={e => update(i, { ...c, level: Number(e.target.value) || 1 })} />
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={addStyle} onClick={() => setConds([...conds, { type: 'quest', questId: '' }])}>+ quest</button>
        <button style={addStyle} onClick={() => setConds([...conds, { type: 'friendship', npcId: '', level: 2 }])}>+ friendship</button>
        <button style={addStyle} onClick={() => setConds([...conds, { type: 'relationship', npcId: '', track: 'ally', level: 2 }])}>+ relationship</button>
      </div>
    </div>
  )
}

const addStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer',
}
