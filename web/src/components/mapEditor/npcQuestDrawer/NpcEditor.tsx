import React, { useState, useEffect, useRef } from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import { NPC_ACTIVITIES } from '../../../game/hub/hubNpcSchedule'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  focusedIndex: number | null
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#888', fontSize: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  )
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
}
const SELECT: React.CSSProperties = { ...INPUT }
const NUM: React.CSSProperties = {
  width: 52, padding: '3px 5px', background: '#111', border: '1px solid #444',
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

// ── Schedule sub-editor ──────────────────────────────────────────────────────

type ScheduleRow = NonNullable<RawNpc['schedule']>[number]

function ScheduleEditor({ schedule, onChange }: {
  schedule: ScheduleRow[]
  onChange: (s: ScheduleRow[]) => void
}) {
  function update(i: number, partial: Partial<ScheduleRow>) {
    onChange(schedule.map((r, idx) => idx === i ? { ...r, ...partial } as ScheduleRow : r))
  }
  function setLocation(i: number, loc: ScheduleRow['location']) {
    update(i, { location: loc })
  }

  return (
    <div>
      {schedule.map((row, i) => (
        <div key={i} style={{ background: '#1a1a3e', border: '1px solid #2a2a5a', borderRadius: 3, padding: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <label style={{ color: '#888', fontSize: 10 }}>From</label>
            <input type="number" value={row.startHour} min={0} max={23}
              onChange={e => update(i, { startHour: Number(e.target.value) })}
              style={NUM} />
            <label style={{ color: '#888', fontSize: 10 }}>To</label>
            <input type="number" value={row.endHour} min={0} max={23}
              onChange={e => update(i, { endHour: Number(e.target.value) })}
              style={NUM} />
            <button onClick={() => onChange(schedule.filter((_, idx) => idx !== i))} style={{ ...BTN_DANGER, marginLeft: 'auto' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={row.location.type}
              onChange={e => {
                const type = e.target.value as 'exterior' | 'interior'
                setLocation(i, type === 'exterior'
                  ? { type: 'exterior', tx: row.location.tx, ty: row.location.ty }
                  : { type: 'interior', buildingId: '', tx: row.location.tx, ty: row.location.ty })
              }}
              style={{ padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10 }}
            >
              <option value="exterior">Exterior</option>
              <option value="interior">Interior</option>
            </select>
            {row.location.type === 'interior' && (
              <input type="text" placeholder="buildingId"
                value={row.location.buildingId}
                onChange={e => setLocation(i, { ...row.location, type: 'interior', buildingId: e.target.value })}
                style={{ width: 80, padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10 }} />
            )}
            <label style={{ color: '#888', fontSize: 10 }}>X</label>
            <input type="number" value={row.location.tx}
              onChange={e => setLocation(i, { ...row.location, tx: Number(e.target.value) })}
              style={{ ...NUM, width: 44 }} />
            <label style={{ color: '#888', fontSize: 10 }}>Y</label>
            <input type="number" value={row.location.ty}
              onChange={e => setLocation(i, { ...row.location, ty: Number(e.target.value) })}
              style={{ ...NUM, width: 44 }} />
            <label style={{ color: '#888', fontSize: 10 }}>Activity</label>
            <select
              value={row.activity ?? ''}
              onChange={e => update(i, { activity: e.target.value ? (e.target.value as ScheduleRow['activity']) : undefined })}
              style={{ padding: '2px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 10 }}
            >
              <option value="">none</option>
              {NPC_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button style={BTN_ADD} onClick={() => onChange([...schedule, { startHour: 8, endHour: 17, location: { type: 'exterior', tx: 0, ty: 0 } }])}>
        + Add time slot
      </button>
    </div>
  )
}

// ── HomeBed sub-editor ───────────────────────────────────────────────────────

function HomeBedEditor({ homeBed, onChange }: {
  homeBed: RawNpc['homeBed']
  onChange: (v: RawNpc['homeBed']) => void
}) {
  if (!homeBed) {
    return (
      <button style={BTN_ADD} onClick={() => onChange({ buildingId: '', tx: 0, ty: 0 })}>
        + Set home bed
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="text" placeholder="buildingId" value={homeBed.buildingId}
        onChange={e => onChange({ ...homeBed, buildingId: e.target.value })}
        style={{ flex: 1, minWidth: 70, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
      <label style={{ color: '#888', fontSize: 10 }}>X</label>
      <input type="number" value={homeBed.tx} onChange={e => onChange({ ...homeBed, tx: Number(e.target.value) })} style={NUM} />
      <label style={{ color: '#888', fontSize: 10 }}>Y</label>
      <input type="number" value={homeBed.ty} onChange={e => onChange({ ...homeBed, ty: Number(e.target.value) })} style={NUM} />
      <button style={BTN_DANGER} onClick={() => onChange(undefined)}>✕</button>
    </div>
  )
}

// ── InnRumours sub-editor ────────────────────────────────────────────────────

type Rumour = NonNullable<RawNpc['innRumours']>[number]

function InnRumoursEditor({ rumours, onChange }: {
  rumours: Rumour[]
  onChange: (r: Rumour[]) => void
}) {
  return (
    <div>
      {rumours.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'flex-start' }}>
          <input type="text" value={r.id} placeholder="id"
            onChange={e => onChange(rumours.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}
            style={{ width: 70, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
          <textarea value={r.text} placeholder="rumour text" rows={2}
            onChange={e => onChange(rumours.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, resize: 'vertical', fontFamily: 'inherit' }} />
          <button style={BTN_DANGER} onClick={() => onChange(rumours.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button style={BTN_ADD} onClick={() => onChange([...rumours, { id: '', text: '' }])}>
        + Add rumour
      </button>
    </div>
  )
}

// ── NpcFullEditor ─────────────────────────────────────────────────────────────

function NpcFullEditor({ npc, questIds, onUpdate }: {
  npc: RawNpc
  questIds: string[]
  onUpdate: (partial: Partial<RawNpc>) => void
}) {
  const questOptions = [
    { value: '', label: '— none —' },
    ...questIds.map(id => ({ value: id, label: id })),
  ]

  const questReceiveArr: string[] = Array.isArray(npc.questReceive)
    ? npc.questReceive
    : npc.questReceive ? [npc.questReceive] : []

  function setQuestReceive(ids: string[]) {
    onUpdate({ questReceive: ids.length === 0 ? undefined : ids.length === 1 ? ids[0] : ids })
  }

  return (
    <div style={{ padding: '8px 10px 12px', borderLeft: '3px solid #4a4aae', marginLeft: 4, marginBottom: 6 }}>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{npc.id}</span>
      </Field>
      <Field label="Name">
        <input style={INPUT} type="text" value={npc.name} onChange={e => onUpdate({ name: e.target.value })} />
      </Field>
      <Field label="Sprite">
        <input style={INPUT} type="text" value={npc.sprite} onChange={e => onUpdate({ sprite: e.target.value })} />
      </Field>
      <Field label="Ghost NPC">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={!!npc.isGhost}
            onChange={e => onUpdate({ isGhost: e.target.checked || undefined })} />
          Is ghost
        </label>
      </Field>
      <Field label="Building">
        <input style={INPUT} type="text" value={npc.building ?? ''} placeholder="building ID (optional)"
          onChange={e => onUpdate({ building: e.target.value || undefined })} />
      </Field>
      <Field label="Quest Give">
        <select style={SELECT} value={npc.questGive ?? ''}
          onChange={e => onUpdate({ questGive: e.target.value || undefined })}>
          {questOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Quest Receive">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {questReceiveArr.map((qid, i) => (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <select
                value={qid}
                onChange={e => {
                  const updated = questReceiveArr.map((x, j) => j === i ? e.target.value : x)
                  setQuestReceive(updated.filter(Boolean))
                }}
                style={{ ...SELECT, flex: 1 }}
              >
                {questIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
              <button style={BTN_DANGER} onClick={() => setQuestReceive(questReceiveArr.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button
            style={{ ...BTN_ADD, fontSize: 10, padding: '2px 8px' }}
            disabled={questIds.length === 0}
            onClick={() => {
              const first = questIds.find(id => !questReceiveArr.includes(id)) ?? questIds[0]
              if (first) setQuestReceive([...questReceiveArr, first])
            }}
          >+ Add</button>
        </div>
      </Field>
      <Field label="Schedule">
        <ScheduleEditor
          schedule={npc.schedule ?? []}
          onChange={s => onUpdate({ schedule: s.length > 0 ? s : undefined })}
        />
      </Field>
      <Field label="Home Bed">
        <HomeBedEditor homeBed={npc.homeBed} onChange={v => onUpdate({ homeBed: v })} />
      </Field>
      <Field label="Inn Rumours">
        <InnRumoursEditor
          rumours={npc.innRumours ?? []}
          onChange={r => onUpdate({ innRumours: r.length > 0 ? r : undefined })}
        />
      </Field>
    </div>
  )
}

// ── NpcEditor (main export) ──────────────────────────────────────────────────

export function NpcEditor({ configData, questDefsData, focusedIndex, onUpdateNpc }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    if (focusedIndex === null) return
    setExpandedIndex(focusedIndex)
    setTimeout(() => {
      rowRefs.current[focusedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [focusedIndex])

  const npcs = configData.npcs ?? []
  const questIds = ((questDefsData.quests as Array<{ id: string }> | undefined) ?? []).map(q => q.id)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 8, color: '#ccc' }}>
      {npcs.length === 0 && (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 20 }}>No NPCs on this map.</div>
      )}
      {npcs.map((npc, i) => (
        <div key={npc.id} ref={el => { rowRefs.current[i] = el }}>
          <div
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            style={{
              padding: '5px 8px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              background: expandedIndex === i ? '#2a2a4e' : '#1e1e3e',
              border: `1px solid ${expandedIndex === i ? '#4a4aae' : '#2a2a4a'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: expandedIndex === i ? 'bold' : 'normal', fontSize: 12 }}>{npc.name}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {npc.questGive && <span style={{ fontSize: 10, color: '#f0c040' }} title="questGive">Q↑</span>}
              {npc.questReceive && <span style={{ fontSize: 10, color: '#40d0f0' }} title="questReceive">Q↓</span>}
              <span style={{ color: '#555', fontSize: 10 }}>{npc.sprite}</span>
              <span style={{ color: '#666', fontSize: 11 }}>{expandedIndex === i ? '▾' : '▸'}</span>
            </div>
          </div>
          {expandedIndex === i && (
            <NpcFullEditor
              npc={npc}
              questIds={questIds}
              onUpdate={partial => onUpdateNpc(i, partial)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
