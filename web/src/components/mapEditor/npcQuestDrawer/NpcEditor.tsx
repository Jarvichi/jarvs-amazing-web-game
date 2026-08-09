import React, { useState, useEffect, useRef } from 'react'
import type { RawMapConfig, RawNpc, RawAnimal } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import { NPC_ACTIVITIES } from '../../../game/hub/hubNpcSchedule'
import { SpriteSearchPicker } from '../SpritePicker'
import { AnimalEditor } from './AnimalEditor'
import type { MapId } from '../../../data/hub/hubWorldFactory'
import { EntityRefPicker, EntityRefMultiPicker } from '../EntityRefPicker'
import { buildingRefOptions, interiorRefOptions, questRefOptions, dialogueTreeRefOptions, conversationTopicRefOptions, type RefOption } from '../entityRefs'
import { SCREEN_IDS } from '../EntityInspector'

// Screens reachable from an NPC's dialogue: the standard SCREEN_IDS list, plus
// special dispatcher keywords handled directly in HubWorld.tsx's
// handleNodeInteract (not full-blown screens, e.g. modals / one-off flows).
const NPC_SCREEN_KEYWORDS = ['adopt-pet', 'town-upgrades', 'bounty-board', 'worldmap', 'campaign', 'endless', 'hub-fishing', 'commander']
const NPC_SCREEN_OPTIONS = Array.from(new Set([...SCREEN_IDS, ...NPC_SCREEN_KEYWORDS])).sort()

export type { PickKind } from '../mapEditorTypes'
import type { PickKind } from '../mapEditorTypes'

interface Props {
  mapId: MapId
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  focusedIndex: number | null
  onAddNpc: (npc: RawNpc) => void
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onAddAnimal: (animal: RawAnimal) => void
  onUpdateAnimal: (index: number, partial: Partial<RawAnimal>) => void
  onDeleteAnimal: (index: number) => void
  onPickLocation: (kind: PickKind, index: number) => void
}

// Reference options threaded into the NPC sub-editors.
interface NpcRefOpts {
  buildings: RefOption[]
  interiors: RefOption[]
  questGive: RefOption[]
  questReceive: RefOption[]
  dialogueTrees: RefOption[]
  conversationTopics: RefOption[]
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
const BTN_PICK: React.CSSProperties = {
  padding: '3px 8px', background: '#1e2a4e', border: '1px solid #3a4a8e',
  color: '#8af', borderRadius: 3, fontSize: 10, cursor: 'pointer', marginLeft: 'auto',
}

// ── Schedule sub-editor ──────────────────────────────────────────────────────

type ScheduleRow = NonNullable<RawNpc['schedule']>[number]

function ScheduleEditor({ schedule, onChange, interiors }: {
  schedule: ScheduleRow[]
  onChange: (s: ScheduleRow[]) => void
  /** Interior room ids (not building ids) — a schedule's interior location is
   *  matched against configData.interiors keys at runtime, and multi-room
   *  buildings have extra rooms whose id differs from the building's own id. */
  interiors: RefOption[]
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
              <div style={{ width: 110 }}>
                <EntityRefPicker value={row.location.buildingId} options={interiors} placeholder="room…"
                  onChange={v => setLocation(i, { ...row.location, type: 'interior', buildingId: v })} />
              </div>
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

function HomeBedEditor({ homeBed, onChange, buildings }: {
  homeBed: RawNpc['homeBed']
  onChange: (v: RawNpc['homeBed']) => void
  buildings: RefOption[]
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
      <div style={{ flex: 1, minWidth: 90 }}>
        <EntityRefPicker value={homeBed.buildingId} options={buildings} placeholder="building…"
          onChange={v => onChange({ ...homeBed, buildingId: v })} />
      </div>
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

function NpcFullEditor({ npc, opts, onUpdate, onPickLocation }: {
  npc: RawNpc
  opts: NpcRefOpts
  onUpdate: (partial: Partial<RawNpc>) => void
  onPickLocation?: () => void
}) {
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
        <SpriteSearchPicker value={npc.sprite} onChange={slug => onUpdate({ sprite: slug })} />
      </Field>
      <Field label="Location">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ color: '#888', fontSize: 10 }}>X</label>
          <input type="number" style={NUM} value={npc.tx} onChange={e => onUpdate({ tx: Number(e.target.value) })} />
          <label style={{ color: '#888', fontSize: 10 }}>Y</label>
          <input type="number" style={NUM} value={npc.ty} onChange={e => onUpdate({ ty: Number(e.target.value) })} />
          {onPickLocation && (
            <button style={BTN_PICK} onClick={onPickLocation}>📍 Pick on map</button>
          )}
        </div>
        {npc.building && <div style={{ color: '#888', fontSize: 10, marginTop: 2 }}>interior: {npc.building}</div>}
      </Field>
      <Field label="Ghost NPC">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={!!npc.isGhost}
            onChange={e => onUpdate({ isGhost: e.target.checked || undefined })} />
          Is ghost
        </label>
      </Field>
      <Field label="Building (interior, optional)">
        <EntityRefPicker value={npc.building ?? ''} options={opts.interiors} placeholder="Search interiors…"
          onChange={v => onUpdate({ building: v || undefined })} />
      </Field>
      <Field label="Dialogue Tree (optional)">
        <EntityRefPicker value={npc.dialogueTree ?? ''} options={opts.dialogueTrees} placeholder="Search dialogue trees…"
          onChange={v => onUpdate({ dialogueTree: v || undefined })} />
      </Field>
      <Field label="Conversation Topics (Make Conversation menu, in display order)">
        <EntityRefMultiPicker values={npc.conversationTopics ?? []} options={opts.conversationTopics} reorderable
          placeholder="Search conversation topics…" onChange={v => onUpdate({ conversationTopics: v.length ? v : undefined })} />
      </Field>
      <Field label="Screen (optional)">
        <input
          style={INPUT} list={`npc-screen-options-${npc.id}`}
          value={npc.screen ?? ''}
          placeholder="e.g. adopt-pet, interior:some-building, narrator:some text…"
          onChange={e => onUpdate({ screen: e.target.value || undefined })}
        />
        <datalist id={`npc-screen-options-${npc.id}`}>
          {NPC_SCREEN_OPTIONS.map(s => <option key={s} value={s} />)}
        </datalist>
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
          Opens a screen or modal when talked to, offered as a dialogue choice alongside their normal dialogue — doesn't replace it.
        </div>
      </Field>
      <Field label="Quest Give">
        <EntityRefPicker value={npc.questGive ?? ''} options={opts.questGive} placeholder="Search quests…"
          onChange={v => onUpdate({ questGive: v || undefined })} />
      </Field>
      <Field label="Quest Receive">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {questReceiveArr.map((qid, i) => (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <div style={{ flex: 1 }}>
                <EntityRefPicker value={qid} options={opts.questReceive} placeholder="Search quests…"
                  onChange={v => setQuestReceive(questReceiveArr.map((x, j) => j === i ? v : x).filter(Boolean))} />
              </div>
              <button style={BTN_DANGER} onClick={() => setQuestReceive(questReceiveArr.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button
            style={{ ...BTN_ADD, fontSize: 10, padding: '2px 8px' }}
            onClick={() => setQuestReceive([...questReceiveArr, ''])}
          >+ Add</button>
        </div>
      </Field>
      <Field label="Schedule">
        <ScheduleEditor
          schedule={npc.schedule ?? []}
          interiors={opts.interiors}
          onChange={s => onUpdate({ schedule: s.length > 0 ? s : undefined })}
        />
      </Field>
      <Field label="Home Bed">
        <HomeBedEditor homeBed={npc.homeBed} buildings={opts.buildings} onChange={v => onUpdate({ homeBed: v })} />
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

export function NpcEditor({
  mapId, configData, questDefsData, focusedIndex,
  onAddNpc, onUpdateNpc, onAddAnimal, onUpdateAnimal, onDeleteAnimal, onPickLocation,
}: Props) {
  // Selection is keyed by kind so NPC and animal rows don't collide.
  const [expanded, setExpanded] = useState<{ kind: PickKind; index: number } | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pendingScroll = useRef<string | null>(null)

  useEffect(() => {
    if (focusedIndex === null) return
    setExpanded({ kind: 'npc', index: focusedIndex })
    setTimeout(() => {
      rowRefs.current[`npc:${focusedIndex}`]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [focusedIndex])

  const npcs = configData.npcs ?? []
  const animals = configData.animals ?? []
  const localQuests = (questDefsData.quests as Array<{ id: string; title?: string }> | undefined) ?? []
  const refOpts: NpcRefOpts = {
    buildings: buildingRefOptions(mapId, configData.buildings ?? []),
    interiors: interiorRefOptions(mapId, configData.interiors),
    questGive: questRefOptions(mapId, localQuests, false),     // this NPC gives quests from its own town
    questReceive: questRefOptions(mapId, localQuests, true),   // may receive cross-town deliveries
    dialogueTrees: dialogueTreeRefOptions(mapId, (questDefsData.dialogues as Array<{ id: string }> | undefined) ?? []),
    conversationTopics: conversationTopicRefOptions(mapId, (questDefsData.conversationTopics as Array<{ id: string; label?: string }> | undefined) ?? []),
  }

  // Scroll to a newly added row after the render that includes it
  useEffect(() => {
    if (pendingScroll.current === null) return
    const key = pendingScroll.current
    pendingScroll.current = null
    setTimeout(() => {
      rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [npcs.length, animals.length])

  function handleAddNpc() {
    const loc = configData.avatarStart ?? { tx: 5, ty: 5 }
    const newIndex = npcs.length
    pendingScroll.current = `npc:${newIndex}`
    onAddNpc({
      id: `npc_${Date.now()}`,
      name: 'New NPC',
      sprite: '',
      tx: loc.tx,
      ty: loc.ty,
      dialogue: ['Hello!'],
    })
    setExpanded({ kind: 'npc', index: newIndex })
  }

  function handleAddAnimal() {
    const loc = configData.avatarStart ?? { tx: 5, ty: 5 }
    const newIndex = animals.length
    pendingScroll.current = `animal:${newIndex}`
    onAddAnimal({
      id: `animal-${Date.now()}`,
      type: 'cat',
      tx: loc.tx,
      ty: loc.ty,
    })
    setExpanded({ kind: 'animal', index: newIndex })
  }

  const isExpanded = (kind: PickKind, i: number) => expanded?.kind === kind && expanded.index === i
  const toggle = (kind: PickKind, i: number) =>
    setExpanded(isExpanded(kind, i) ? null : { kind, index: i })

  return (
    <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: 8, color: '#ccc' }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
        <button style={BTN_ADD} onClick={handleAddNpc}>+ Add NPC</button>
        <button style={{ ...BTN_ADD, background: '#1a2e1a', border: '1px solid #3a6a3a', color: '#88ffaa' }} onClick={handleAddAnimal}>+ Add Animal</button>
      </div>

      {npcs.length === 0 && animals.length === 0 && (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8 }}>No NPCs or animals on this map.</div>
      )}

      {npcs.map((npc, i) => (
        <div key={npc.id} ref={el => { rowRefs.current[`npc:${i}`] = el }}>
          <div
            onClick={() => toggle('npc', i)}
            style={{
              padding: '5px 8px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              background: isExpanded('npc', i) ? '#2a2a4e' : '#1e1e3e',
              border: `1px solid ${isExpanded('npc', i) ? '#4a4aae' : '#2a2a4a'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: isExpanded('npc', i) ? 'bold' : 'normal', fontSize: 12 }}>{npc.name}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {npc.questGive && <span style={{ fontSize: 10, color: '#f0c040' }} title="questGive">Q↑</span>}
              {npc.questReceive && <span style={{ fontSize: 10, color: '#40d0f0' }} title="questReceive">Q↓</span>}
              <span style={{ color: '#555', fontSize: 10 }}>{npc.sprite || '(default)'}</span>
              <span style={{ color: '#666', fontSize: 11 }}>{isExpanded('npc', i) ? '▾' : '▸'}</span>
            </div>
          </div>
          {isExpanded('npc', i) && (
            <NpcFullEditor
              npc={npc}
              opts={refOpts}
              onUpdate={partial => onUpdateNpc(i, partial)}
              onPickLocation={() => onPickLocation('npc', i)}
            />
          )}
        </div>
      ))}

      {animals.length > 0 && (
        <div style={{ color: '#88ffaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '10px 0 4px' }}>Animals</div>
      )}
      {animals.map((animal, i) => (
        <div key={animal.id} ref={el => { rowRefs.current[`animal:${i}`] = el }}>
          <div
            onClick={() => toggle('animal', i)}
            style={{
              padding: '5px 8px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              background: isExpanded('animal', i) ? '#1e3a1e' : '#1a2a1a',
              border: `1px solid ${isExpanded('animal', i) ? '#3a6a3a' : '#234023'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: isExpanded('animal', i) ? 'bold' : 'normal', fontSize: 12 }}>{animal.name || animal.type}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {animal.questGive && <span style={{ fontSize: 10, color: '#f0c040' }} title="questGive">Q↑</span>}
              {animal.questReceive && <span style={{ fontSize: 10, color: '#40d0f0' }} title="questReceive">Q↓</span>}
              <span style={{ color: '#558855', fontSize: 10 }}>{animal.type}</span>
              <span style={{ color: '#666', fontSize: 11 }}>{isExpanded('animal', i) ? '▾' : '▸'}</span>
            </div>
          </div>
          {isExpanded('animal', i) && (
            <AnimalEditor
              animal={animal}
              onUpdate={partial => onUpdateAnimal(i, partial)}
              onDelete={() => { onDeleteAnimal(i); setExpanded(null) }}
              onPickLocation={() => onPickLocation('animal', i)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
