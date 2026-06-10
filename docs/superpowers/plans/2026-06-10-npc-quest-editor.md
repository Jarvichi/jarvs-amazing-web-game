# NPC / Quest Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resizable bottom drawer to the map editor with full NPC field editing and quest definition CRUD (create, edit, delete), with bidirectional NPC↔quest links.

**Architecture:** A new `NpcQuestDrawer` component renders below the canvas when toggled open, with two tabs (NPCs / Quests). NPC edits flow through a new `updateNpc` action in `useMapEditorState` (with undo support). Quest edits mutate `questDefsData` directly in `MapEditor` local state, same as today. Clicking an NPC on the canvas auto-opens the drawer to that NPC.

**Tech Stack:** React 18, TypeScript, Vitest (pure-function tests only — no jsdom), inline CSS (dark theme matching existing editor).

---

## File Map

**New files:**
- `web/src/components/mapEditor/npcQuestDrawer/npcQuestDrawerTypes.ts` — shared local types
- `web/src/components/mapEditor/npcQuestDrawer/questValidation.ts` — pure validation helpers
- `web/src/components/mapEditor/npcQuestDrawer/questValidation.test.ts` — Vitest tests
- `web/src/components/mapEditor/npcQuestDrawer/NpcQuestDrawer.tsx` — outer shell, tab bar
- `web/src/components/mapEditor/npcQuestDrawer/NpcEditor.tsx` — NPC list + full field editor
- `web/src/components/mapEditor/npcQuestDrawer/QuestEditor.tsx` — quest list + CRUD form

**Modified files:**
- `web/src/components/mapEditor/useMapEditorState.ts` — add `updateNpc` action
- `web/src/components/mapEditor/MapEditor.tsx` — drawer state, layout restructure, NPC focus effect
- `web/src/components/mapEditor/MapEditorToolbar.tsx` — "NPCs & Quests" toggle button + save validation

---

## Task 1: Quest validation helpers

**Files:**
- Create: `web/src/components/mapEditor/npcQuestDrawer/questValidation.ts`
- Create: `web/src/components/mapEditor/npcQuestDrawer/questValidation.test.ts`

- [ ] **Step 1: Create the validation module**

`web/src/components/mapEditor/npcQuestDrawer/questValidation.ts`:
```typescript
export function isQuestIdUnique(
  id: string,
  quests: Array<{ id: string }>,
  excludeIndex: number,
): boolean {
  return quests.every((q, i) => i === excludeIndex || q.id !== id)
}

export function generateQuestId(existingIds: string[]): string {
  const set = new Set(existingIds)
  let n = 1
  while (set.has(`new-quest-${n}`)) n++
  return `new-quest-${n}`
}
```

- [ ] **Step 2: Write the tests**

`web/src/components/mapEditor/npcQuestDrawer/questValidation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { isQuestIdUnique, generateQuestId } from './questValidation'

describe('isQuestIdUnique', () => {
  const quests = [{ id: 'quest-a' }, { id: 'quest-b' }, { id: 'quest-c' }]

  it('returns true when id does not exist in the list', () => {
    expect(isQuestIdUnique('quest-z', quests, -1)).toBe(true)
  })

  it('returns false when another quest has the same id', () => {
    expect(isQuestIdUnique('quest-a', quests, 1)).toBe(false)
  })

  it('returns true when the only match is the excluded index', () => {
    expect(isQuestIdUnique('quest-a', quests, 0)).toBe(true)
  })

  it('returns false when list has one entry with same id', () => {
    expect(isQuestIdUnique('quest-a', [{ id: 'quest-a' }], -1)).toBe(false)
  })
})

describe('generateQuestId', () => {
  it('returns new-quest-1 for empty list', () => {
    expect(generateQuestId([])).toBe('new-quest-1')
  })

  it('returns new-quest-1 when no new-quest-N ids exist', () => {
    expect(generateQuestId(['fetch-herbs', 'lost-pendant'])).toBe('new-quest-1')
  })

  it('increments past consecutive existing ids', () => {
    expect(generateQuestId(['new-quest-1', 'new-quest-2', 'new-quest-3'])).toBe('new-quest-4')
  })

  it('fills the first gap in the sequence', () => {
    expect(generateQuestId(['new-quest-1', 'new-quest-3'])).toBe('new-quest-2')
  })
})
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
cd web && npm test -- questValidation
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/mapEditor/npcQuestDrawer/questValidation.ts \
        web/src/components/mapEditor/npcQuestDrawer/questValidation.test.ts
git commit -m "feat(map-editor): add quest ID validation helpers"
```

---

## Task 2: Add `updateNpc` to `useMapEditorState`

**Files:**
- Modify: `web/src/components/mapEditor/useMapEditorState.ts`

- [ ] **Step 1: Add `updateNpc` callback after `updateNpcDialogue` (around line 276)**

Insert this block after the `updateNpcDialogue` useCallback and before the `undo` useCallback:

```typescript
const updateNpc = useCallback((index: number, partial: Partial<RawNpc>) => {
  setState(s => {
    const prevConfig = s.configData
    const npcs = [...(prevConfig.npcs ?? [])]
    if (!npcs[index]) return s
    npcs[index] = { ...npcs[index], ...partial }
    return {
      ...s,
      configData: { ...prevConfig, npcs },
      undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
      redoStack: [],
      isDirty: true,
    }
  })
}, [])
```

- [ ] **Step 2: Add `updateNpc` to the return object**

The return statement at the bottom of `useMapEditorState` currently ends with `markSaved`. Add `updateNpc` to it:

```typescript
  return {
    state,
    setMapId,
    setTool,
    setActiveTile,
    setZlayer,
    openInterior,
    closeInterior,
    selectEntity,
    placeDecor,
    moveEntity,
    deleteEntity,
    updateDecorZlayer,
    updateNpcDialogue,
    updateNpc,
    undo,
    redo,
    addStreet,
    updateStreetEntry,
    markSaved,
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/mapEditor/useMapEditorState.ts
git commit -m "feat(map-editor): add updateNpc action to useMapEditorState"
```

---

## Task 3: Drawer types + NpcQuestDrawer shell

**Files:**
- Create: `web/src/components/mapEditor/npcQuestDrawer/npcQuestDrawerTypes.ts`
- Create: `web/src/components/mapEditor/npcQuestDrawer/NpcQuestDrawer.tsx`

- [ ] **Step 1: Create the types file**

`web/src/components/mapEditor/npcQuestDrawer/npcQuestDrawerTypes.ts`:
```typescript
export type DrawerTab = 'npcs' | 'quests'
```

- [ ] **Step 2: Create the drawer shell**

`web/src/components/mapEditor/npcQuestDrawer/NpcQuestDrawer.tsx`:
```tsx
import React from 'react'
import type { DrawerTab } from './npcQuestDrawerTypes'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import { NpcEditor } from './NpcEditor'
import { QuestEditor } from './QuestEditor'

interface Props {
  tab: DrawerTab
  focusedNpcIndex: number | null
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onTabChange: (tab: DrawerTab) => void
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

const TAB_ACTIVE: React.CSSProperties = {
  padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
  background: 'transparent', border: 'none', borderBottom: '2px solid #8af', color: '#8af',
}
const TAB_INACTIVE: React.CSSProperties = {
  padding: '6px 16px', cursor: 'pointer', fontSize: 12,
  background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#666',
}

export function NpcQuestDrawer({
  tab, focusedNpcIndex, configData, questDefsData,
  onTabChange, onUpdateNpc, onQuestDefsChange,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#12122a', borderTop: '1px solid #333' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #333', flexShrink: 0, padding: '0 8px', background: '#0f0f22' }}>
        <button style={tab === 'npcs' ? TAB_ACTIVE : TAB_INACTIVE} onClick={() => onTabChange('npcs')}>
          NPCs
        </button>
        <button style={tab === 'quests' ? TAB_ACTIVE : TAB_INACTIVE} onClick={() => onTabChange('quests')}>
          Quests
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {tab === 'npcs' && (
          <NpcEditor
            configData={configData}
            questDefsData={questDefsData}
            focusedIndex={focusedNpcIndex}
            onUpdateNpc={onUpdateNpc}
          />
        )}
        {tab === 'quests' && (
          <QuestEditor
            configData={configData}
            questDefsData={questDefsData}
            onUpdateNpc={onUpdateNpc}
            onQuestDefsChange={onQuestDefsChange}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create stub files for NpcEditor and QuestEditor** so TypeScript can resolve the imports before those tasks are done.

`web/src/components/mapEditor/npcQuestDrawer/NpcEditor.tsx`:
```tsx
import React from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  focusedIndex: number | null
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
}

export function NpcEditor(_props: Props) {
  return <div style={{ padding: 16, color: '#666' }}>NPC editor — coming soon</div>
}
```

`web/src/components/mapEditor/npcQuestDrawer/QuestEditor.tsx`:
```tsx
import React from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

export function QuestEditor(_props: Props) {
  return <div style={{ padding: 16, color: '#666' }}>Quest editor — coming soon</div>
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/mapEditor/npcQuestDrawer/
git commit -m "feat(map-editor): scaffold NpcQuestDrawer shell and stubs"
```

---

## Task 4: NpcEditor — full implementation

**Files:**
- Modify (replace): `web/src/components/mapEditor/npcQuestDrawer/NpcEditor.tsx`

- [ ] **Step 1: Replace the stub with the full implementation**

`web/src/components/mapEditor/npcQuestDrawer/NpcEditor.tsx`:
```tsx
import React, { useState, useEffect, useRef } from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/mapEditor/npcQuestDrawer/NpcEditor.tsx
git commit -m "feat(map-editor): implement NpcEditor with full field editing"
```

---

## Task 5: QuestEditor — full implementation

**Files:**
- Modify (replace): `web/src/components/mapEditor/npcQuestDrawer/QuestEditor.tsx`

- [ ] **Step 1: Replace the stub with the full implementation**

`web/src/components/mapEditor/npcQuestDrawer/QuestEditor.tsx`:
```tsx
import React, { useState } from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import type { QuestDefinition, QuestReward, QuestStep } from '../../../data/hub/questDefs'
import { isQuestIdUnique, generateQuestId } from './questValidation'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

function getQuests(qd: QuestDefsJson): QuestDefinition[] {
  return (qd.quests as QuestDefinition[] | undefined) ?? []
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
const TEXTAREA: React.CSSProperties = {
  ...INPUT, resize: 'vertical', fontFamily: 'inherit', minHeight: 56,
}
const BTN_DANGER: React.CSSProperties = {
  padding: '2px 7px', background: '#5a1a1a', border: '1px solid #922',
  color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer',
}
const BTN_ADD: React.CSSProperties = {
  padding: '3px 10px', background: '#1e2e1e', border: '1px solid #3a5a3a',
  color: '#6d6', borderRadius: 3, fontSize: 11, cursor: 'pointer',
}
const NUM: React.CSSProperties = {
  width: 52, padding: '3px 5px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11,
}

// ── Steps editor ─────────────────────────────────────────────────────────────

type AnyStep = { key: string; type: string; pickupIds?: string[]; required: number; targetNpcId?: string }

function StepsEditor({ steps, npcIds, onChange }: {
  steps: AnyStep[]
  npcIds: string[]
  onChange: (steps: AnyStep[]) => void
}) {
  function update(i: number, partial: Partial<AnyStep>) {
    onChange(steps.map((s, idx) => idx === i ? { ...s, ...partial } : s))
  }

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} style={{ background: '#1a1a3e', border: '1px solid #2a2a5a', borderRadius: 3, padding: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input type="text" value={step.key} placeholder="step key"
              onChange={e => update(i, { key: e.target.value })}
              style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
            <select
              value={step.type}
              onChange={e => {
                const t = e.target.value
                update(i, t === 'collect'
                  ? { type: t, pickupIds: step.pickupIds ?? [], targetNpcId: undefined }
                  : { type: t, targetNpcId: step.targetNpcId ?? '', pickupIds: undefined })
              }}
              style={{ padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
            >
              <option value="collect">collect</option>
              <option value="deliver">deliver</option>
            </select>
            <label style={{ color: '#888', fontSize: 10 }}>req</label>
            <input type="number" value={step.required} min={1}
              onChange={e => update(i, { required: Number(e.target.value) })}
              style={NUM} />
            <button style={BTN_DANGER} onClick={() => onChange(steps.filter((_, idx) => idx !== i))}>✕</button>
          </div>
          {step.type === 'collect' && (
            <div>
              <label style={{ color: '#888', fontSize: 10 }}>Pickup IDs (comma-separated)</label>
              <input type="text"
                value={(step.pickupIds ?? []).join(', ')}
                onChange={e => update(i, { pickupIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                style={{ ...INPUT, marginTop: 2 }} />
            </div>
          )}
          {step.type === 'deliver' && (
            <div>
              <label style={{ color: '#888', fontSize: 10 }}>Target NPC</label>
              <select value={step.targetNpcId ?? ''}
                onChange={e => update(i, { targetNpcId: e.target.value })}
                style={{ ...SELECT, marginTop: 2 }}>
                <option value="">— select NPC —</option>
                {npcIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      <button style={BTN_ADD}
        onClick={() => onChange([...steps, { key: `step-${steps.length + 1}`, type: 'collect', pickupIds: [], required: 1 }])}>
        + Add step
      </button>
    </div>
  )
}

// ── Reward editor ─────────────────────────────────────────────────────────────

function RewardEditor({ reward, onChange }: {
  reward: QuestReward
  onChange: (r: QuestReward) => void
}) {
  const friendshipEntries = Object.entries(reward.friendship ?? {}) as Array<[string, number]>

  function setFriendship(entries: Array<[string, number]>) {
    onChange({ ...reward, friendship: entries.length > 0 ? Object.fromEntries(entries) : undefined })
  }

  return (
    <div>
      <Field label="Crystals">
        <input type="number" value={reward.crystals ?? ''} min={0} placeholder="0"
          onChange={e => onChange({ ...reward, crystals: e.target.value ? Number(e.target.value) : undefined })}
          style={{ ...NUM, width: 80 }} />
      </Field>
      <Field label="Friendship (npcId → amount)">
        <div>
          {friendshipEntries.map(([npcId, amount], i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
              <input type="text" value={npcId} placeholder="npcId"
                onChange={e => setFriendship(friendshipEntries.map((p, j) => j === i ? [e.target.value, p[1]] : p))}
                style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} />
              <input type="number" value={amount}
                onChange={e => setFriendship(friendshipEntries.map((p, j) => j === i ? [p[0], Number(e.target.value)] : p))}
                style={NUM} />
              <button style={BTN_DANGER} onClick={() => setFriendship(friendshipEntries.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={{ ...BTN_ADD, fontSize: 10, padding: '2px 8px' }}
            onClick={() => setFriendship([...friendshipEntries, ['', 10]])}>+ Add</button>
        </div>
      </Field>
      <Field label="Collectible">
        {reward.collectible ? (
          <div style={{ background: '#1a1a3e', border: '1px solid #2a2a5a', borderRadius: 3, padding: 6 }}>
            {(['id', 'name', 'icon', 'desc'] as const).map(key => (
              <div key={key} style={{ marginBottom: 4 }}>
                <label style={{ color: '#888', fontSize: 10 }}>{key}</label>
                <input type="text" value={reward.collectible![key]}
                  onChange={e => onChange({ ...reward, collectible: { ...reward.collectible!, [key]: e.target.value } })}
                  style={{ ...INPUT, marginTop: 1 }} />
              </div>
            ))}
            <button style={BTN_DANGER} onClick={() => onChange({ ...reward, collectible: undefined })}>Remove collectible</button>
          </div>
        ) : (
          <button style={BTN_ADD} onClick={() => onChange({ ...reward, collectible: { id: '', name: '', icon: '', desc: '' } })}>
            + Add collectible
          </button>
        )}
      </Field>
      <Field label="Unlock">
        <input type="text" value={reward.unlock ?? ''} placeholder="unlock key (optional)"
          onChange={e => onChange({ ...reward, unlock: e.target.value || undefined })}
          style={INPUT} />
      </Field>
    </div>
  )
}

// ── Quest full editor ─────────────────────────────────────────────────────────

function QuestFullEditor({ quest, questIndex, allQuests, configData, onApply, onDelete, onUpdateNpc }: {
  quest: QuestDefinition
  questIndex: number
  allQuests: QuestDefinition[]
  configData: RawMapConfig
  onApply: (updated: QuestDefinition) => void
  onDelete: () => void
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
}) {
  const [draft, setDraft] = useState<QuestDefinition>(() => structuredClone(quest))
  const [idError, setIdError] = useState('')
  const [formError, setFormError] = useState('')
  const [applied, setApplied] = useState(false)

  const npcs = configData.npcs ?? []
  const npcIds = npcs.map(n => n.id)
  const npcOptions = [{ value: '', label: '— none —' }, ...npcIds.map(id => ({ value: id, label: id }))]
  const questOptions = [{ value: '', label: '— none —' }, ...allQuests.filter((_, i) => i !== questIndex).map(q => ({ value: q.id, label: q.title }))]

  const isChain = draft.type === 'chain'
  const steps = draft.steps as AnyStep[]
  const stepKeys = steps.map(s => s.key)

  // active dialogue helpers
  const activeStr = typeof draft.activeDialogue === 'string' ? draft.activeDialogue : ''
  const activeMap: Record<string, string> = typeof draft.activeDialogue === 'object' && draft.activeDialogue !== null
    ? draft.activeDialogue as Record<string, string>
    : {}

  function syncChainDialogue(keys: string[], map: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const k of keys) out[k] = map[k] ?? ''
    return out
  }

  function setSteps(newSteps: AnyStep[]) {
    const newKeys = newSteps.map(s => s.key)
    setDraft(d => ({
      ...d,
      steps: newSteps as QuestStep[],
      activeDialogue: isChain ? syncChainDialogue(newKeys, activeMap) : d.activeDialogue,
    }))
  }

  function setType(type: string) {
    setDraft(d => ({
      ...d,
      type,
      activeDialogue: type === 'chain' ? syncChainDialogue(stepKeys, activeMap) : activeStr,
    }))
  }

  function setId(id: string) {
    setIdError(id && !isQuestIdUnique(id, allQuests, questIndex) ? 'ID already in use' : '')
    setDraft(d => ({ ...d, id }))
  }

  function handleApply() {
    setFormError('')
    if (idError) return
    if (!draft.id.trim()) { setIdError('ID is required'); return }
    if (!draft.title.trim()) { setFormError('Title is required'); return }
    if (!draft.giverNpcId) { setFormError('Giver NPC is required'); return }
    if ((draft.steps as AnyStep[]).length === 0) { setFormError('At least one step is required'); return }

    // Bidirectional NPC sync — compare draft vs committed quest
    const oldGiver = quest.giverNpcId
    const newGiver = draft.giverNpcId
    if (oldGiver !== newGiver) {
      if (oldGiver) {
        const idx = npcs.findIndex(n => n.id === oldGiver)
        if (idx >= 0 && npcs[idx].questGive === quest.id) onUpdateNpc(idx, { questGive: undefined })
      }
      if (newGiver) {
        const idx = npcs.findIndex(n => n.id === newGiver)
        if (idx >= 0) onUpdateNpc(idx, { questGive: draft.id })
      }
    }

    const oldReceiver = quest.receiverNpcId
    const newReceiver = draft.receiverNpcId
    if (oldReceiver !== newReceiver) {
      if (oldReceiver) {
        const idx = npcs.findIndex(n => n.id === oldReceiver)
        if (idx >= 0) {
          const qr = npcs[idx].questReceive
          const arr = Array.isArray(qr) ? qr : qr ? [qr] : []
          const filtered = arr.filter(id => id !== quest.id)
          onUpdateNpc(idx, { questReceive: filtered.length === 0 ? undefined : filtered.length === 1 ? filtered[0] : filtered })
        }
      }
      if (newReceiver) {
        const idx = npcs.findIndex(n => n.id === newReceiver)
        if (idx >= 0) {
          const qr = npcs[idx].questReceive
          const arr = Array.isArray(qr) ? qr : qr ? [qr] : []
          if (!arr.includes(draft.id)) {
            const updated = [...arr, draft.id]
            onUpdateNpc(idx, { questReceive: updated.length === 1 ? updated[0] : updated })
          }
        }
      }
    }

    onApply(draft)
    setApplied(true)
    setTimeout(() => setApplied(false), 1500)
  }

  return (
    <div style={{ padding: '8px 10px 12px', borderLeft: '3px solid #5a3a8e', marginLeft: 4, marginBottom: 6 }}>
      {/* Identity */}
      <Field label="ID">
        <input style={{ ...INPUT, borderColor: idError ? '#f66' : '#444' }} type="text" value={draft.id}
          onChange={e => setId(e.target.value)} />
        {idError && <div style={{ color: '#f66', fontSize: 10, marginTop: 2 }}>{idError}</div>}
      </Field>
      <Field label="Title">
        <input style={INPUT} type="text" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
      </Field>
      <Field label="Type">
        <select style={SELECT} value={draft.type} onChange={e => setType(e.target.value)}>
          <option value="fetch">fetch</option>
          <option value="chain">chain</option>
          <option value="lost-items">lost-items</option>
        </select>
      </Field>
      <Field label="Prerequisite">
        <select style={SELECT} value={draft.prerequisite ?? ''}
          onChange={e => setDraft(d => ({ ...d, prerequisite: e.target.value || undefined }))}>
          {questOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      {/* NPC links */}
      <Field label="Giver NPC">
        <select style={SELECT} value={draft.giverNpcId ?? ''}
          onChange={e => setDraft(d => ({ ...d, giverNpcId: e.target.value }))}>
          {npcOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Receiver NPC">
        <select style={SELECT} value={draft.receiverNpcId ?? ''}
          onChange={e => setDraft(d => ({ ...d, receiverNpcId: e.target.value || undefined }))}>
          {npcOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      {/* Dialogue */}
      <Field label="Offer Dialogue">
        <textarea style={TEXTAREA} rows={3}
          value={typeof draft.offerDialogue === 'string' ? draft.offerDialogue : ''}
          onChange={e => setDraft(d => ({ ...d, offerDialogue: e.target.value }))} />
      </Field>
      <Field label="Active Dialogue">
        {!isChain ? (
          <textarea style={TEXTAREA} rows={2} value={activeStr}
            onChange={e => setDraft(d => ({ ...d, activeDialogue: e.target.value }))} />
        ) : (
          <div>
            {stepKeys.map(key => (
              <div key={key} style={{ marginBottom: 4 }}>
                <label style={{ color: '#888', fontSize: 10 }}>{key}</label>
                <textarea style={{ ...TEXTAREA, minHeight: 36 }} rows={2}
                  value={activeMap[key] ?? ''}
                  onChange={e => setDraft(d => ({
                    ...d,
                    activeDialogue: { ...(d.activeDialogue as Record<string, string>), [key]: e.target.value },
                  }))} />
              </div>
            ))}
            {stepKeys.length === 0 && <div style={{ color: '#555', fontSize: 11 }}>Add steps below to create chain dialogue rows.</div>}
          </div>
        )}
      </Field>
      <Field label="Complete Dialogue">
        <textarea style={TEXTAREA} rows={3}
          value={typeof draft.completeDialogue === 'string' ? draft.completeDialogue : ''}
          onChange={e => setDraft(d => ({ ...d, completeDialogue: e.target.value }))} />
      </Field>

      {/* Steps */}
      <Field label="Steps">
        <StepsEditor steps={steps} npcIds={npcIds} onChange={setSteps} />
      </Field>

      {/* Reward */}
      <Field label="Reward">
        <RewardEditor
          reward={draft.reward ?? {}}
          onChange={reward => setDraft(d => ({ ...d, reward }))}
        />
      </Field>

      {/* Actions */}
      {formError && <div style={{ color: '#f88', fontSize: 11, marginBottom: 6 }}>{formError}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleApply}
          disabled={!!idError}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 3, fontSize: 12, cursor: idError ? 'not-allowed' : 'pointer',
            background: applied ? '#1e4e1e' : '#2a3a7e',
            color: applied ? '#6f6' : '#8af',
            border: `1px solid ${applied ? '#3a7a3a' : '#4a5aae'}`,
            fontWeight: 'bold',
          }}
        >
          {applied ? '✓ Applied' : 'Apply Changes'}
        </button>
        <button onClick={onDelete} style={{ ...BTN_DANGER, padding: '6px 14px', fontSize: 12 }}>Delete</button>
      </div>
    </div>
  )
}

// ── QuestEditor (main export) ──────────────────────────────────────────────

export function QuestEditor({ configData, questDefsData, onUpdateNpc, onQuestDefsChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [deleteNotice, setDeleteNotice] = useState('')

  const quests = getQuests(questDefsData)

  function handleNewQuest() {
    const id = generateQuestId(quests.map(q => q.id))
    const blank: QuestDefinition = {
      id,
      title: 'New Quest',
      type: 'fetch',
      giverNpcId: '',
      offerDialogue: '',
      activeDialogue: '',
      completeDialogue: '',
      steps: [],
      reward: {},
    }
    onQuestDefsChange(prev => ({ ...prev, quests: [...getQuests(prev), blank] }))
    setExpandedIndex(quests.length) // expand the new quest
  }

  function handleApply(index: number, updated: QuestDefinition) {
    onQuestDefsChange(prev => {
      const list = [...getQuests(prev)]
      list[index] = updated
      return { ...prev, quests: list }
    })
  }

  function handleDelete(index: number) {
    const deletedId = quests[index].id
    // Clear questGive / questReceive on any NPCs referencing this quest
    const npcs = configData.npcs ?? []
    let clearedCount = 0
    npcs.forEach((npc, npcIdx) => {
      const updates: Partial<RawNpc> = {}
      if (npc.questGive === deletedId) { updates.questGive = undefined; clearedCount++ }
      if (npc.questReceive) {
        const arr = Array.isArray(npc.questReceive) ? npc.questReceive : [npc.questReceive]
        const filtered = arr.filter(id => id !== deletedId)
        if (filtered.length !== arr.length) {
          updates.questReceive = filtered.length === 0 ? undefined : filtered.length === 1 ? filtered[0] : filtered
          clearedCount++
        }
      }
      if (Object.keys(updates).length > 0) onUpdateNpc(npcIdx, updates)
    })

    onQuestDefsChange(prev => ({ ...prev, quests: getQuests(prev).filter((_, i) => i !== index) }))
    setExpandedIndex(null)
    if (clearedCount > 0) {
      setDeleteNotice(`Cleared from ${clearedCount} NPC${clearedCount > 1 ? 's' : ''}`)
      setTimeout(() => setDeleteNotice(''), 3000)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 8, color: '#ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button style={BTN_ADD} onClick={handleNewQuest}>+ New Quest</button>
        {deleteNotice && <span style={{ color: '#f0c040', fontSize: 11 }}>{deleteNotice}</span>}
      </div>
      {quests.length === 0 && (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          No quests yet — click + New Quest to get started.
        </div>
      )}
      {quests.map((quest, i) => (
        <div key={`${quest.id}-${i}`}>
          <div
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            style={{
              padding: '5px 8px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
              background: expandedIndex === i ? '#2a1e4e' : '#1e1e3e',
              border: `1px solid ${expandedIndex === i ? '#6a3aae' : '#2a2a4a'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: expandedIndex === i ? 'bold' : 'normal', fontSize: 12 }}>{quest.title || quest.id}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 2,
                background: quest.type === 'chain' ? '#3a2a5e' : quest.type === 'lost-items' ? '#3a2a1e' : '#1e3a3e',
                color: quest.type === 'chain' ? '#a8f' : quest.type === 'lost-items' ? '#f0c040' : '#4df',
              }}>{quest.type}</span>
              <span style={{ color: '#555', fontSize: 10 }}>{quest.giverNpcId}</span>
              <span style={{ color: '#666', fontSize: 11 }}>{expandedIndex === i ? '▾' : '▸'}</span>
            </div>
          </div>
          {expandedIndex === i && (
            <QuestFullEditor
              quest={quest}
              questIndex={i}
              allQuests={quests}
              configData={configData}
              onApply={updated => handleApply(i, updated)}
              onDelete={() => handleDelete(i)}
              onUpdateNpc={onUpdateNpc}
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/mapEditor/npcQuestDrawer/QuestEditor.tsx
git commit -m "feat(map-editor): implement QuestEditor with full CRUD and NPC linking"
```

---

## Task 6: Integrate drawer into MapEditor + toolbar

**Files:**
- Modify: `web/src/components/mapEditor/MapEditor.tsx`
- Modify: `web/src/components/mapEditor/MapEditorToolbar.tsx`

- [ ] **Step 1: Update `MapEditorToolbar.tsx` — add drawer toggle button and save validation**

Add `drawerOpen` and `onDrawerToggle` to the Props interface, after `onQuestItemsToggle`:

```typescript
interface Props {
  // ... existing props ...
  drawerOpen: boolean
  onDrawerToggle: () => void
  hasDuplicateQuestIds: boolean
}
```

Add the toggle button after the quest-items button (after the `◈` button block, before `<div style={{ flex: 1 }} />`):

```tsx
{/* NPC/Quest drawer toggle */}
<button
  title="NPCs & Quests editor"
  onClick={onDrawerToggle}
  style={{
    ...btnBase,
    background: drawerOpen ? '#2a1e4e' : '#1e1e3e',
    color:      drawerOpen ? '#a8f' : '#666',
    borderColor: drawerOpen ? '#6a3aae' : '#444',
  }}
>
  ⚇
</button>
```

In `handleSave`, add a guard before the save calls:

```typescript
const handleSave = async () => {
  if (hasDuplicateQuestIds) {
    setSaveState('error')
    setSaveError('Duplicate quest IDs — fix before saving')
    setTimeout(() => setSaveState('idle'), 4000)
    return
  }
  // ... rest of existing save logic unchanged ...
}
```

- [ ] **Step 2: Update `MapEditor.tsx` — add drawer state, layout, and NPC focus effect**

Update the React import at the top of `MapEditor.tsx` to include `useRef`:

```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react'
```

Add these further imports at the top of `MapEditor.tsx`:

```typescript
import { NpcQuestDrawer } from './npcQuestDrawer/NpcQuestDrawer'
import type { DrawerTab } from './npcQuestDrawer/npcQuestDrawerTypes'
```

Add drawer state after the existing `useState` calls (after `showQuestItems`):

```typescript
const [drawerOpen, setDrawerOpen] = useState(false)
const [drawerTab, setDrawerTab] = useState<DrawerTab>('npcs')
const [focusedNpcIndex, setFocusedNpcIndex] = useState<number | null>(null)
const [drawerHeight, setDrawerHeight] = useState(280)
const drawerDragRef = useRef<{ startY: number; startH: number } | null>(null)
```

Add `updateNpc` to the destructured return from `useMapEditorState`:

```typescript
const {
  state, setMapId, setTool, setActiveTile, setZlayer,
  openInterior, closeInterior, selectEntity,
  placeDecor, moveEntity, deleteEntity,
  updateDecorZlayer, updateNpcDialogue, updateNpc,
  addStreet, updateStreetEntry,
  undo, redo, markSaved,
} = useMapEditorState(initialMapId)
```

Add the NPC focus effect after the `questDefsData` reset effect (after the `useEffect` that resets `questDefsData` on map change):

```typescript
// Auto-open drawer to NPC tab when user clicks an NPC on the canvas
const prevSelectedEntityRef = useRef(state.selectedEntity)
useEffect(() => {
  const cur = state.selectedEntity
  const prev = prevSelectedEntityRef.current
  if (cur?.type === 'npc' && cur !== prev) {
    setDrawerOpen(true)
    setDrawerTab('npcs')
    setFocusedNpcIndex(cur.index)
  }
  prevSelectedEntityRef.current = cur
}, [state.selectedEntity])
```

Add the resize drag handlers after that effect:

```typescript
const handleDragStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  drawerDragRef.current = { startY: e.clientY, startH: drawerHeight }
  const onMove = (ev: MouseEvent) => {
    if (!drawerDragRef.current) return
    const delta = drawerDragRef.current.startY - ev.clientY
    setDrawerHeight(Math.max(120, Math.min(600, drawerDragRef.current.startH + delta)))
  }
  const onUp = () => {
    drawerDragRef.current = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}, [drawerHeight])
```

Add the `hasDuplicateQuestIds` computed value before the return:

```typescript
const questIdCounts = ((questDefsData?.quests as Array<{id:string}> | undefined) ?? [])
  .reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.id]: (acc[q.id] ?? 0) + 1 }), {})
const hasDuplicateQuestIds = Object.values(questIdCounts).some(n => n > 1)
```

Replace the return JSX. Change the outer body div from:

```tsx
<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
  {/* Left: Tile palette */}
  ...
  {/* Center: Map canvas */}
  ...
  {/* Right: Inspector */}
  ...
</div>
```

To:

```tsx
<div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
  {/* Canvas row */}
  <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
    {/* Left: Tile palette */}
    <div style={{ width: 192, flexShrink: 0, borderRight: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TilePalette
        activeTileId={state.activeTileId}
        activeBundleId={state.activeBundleId}
        activeZlayer={state.activeZlayer}
        onSelectTile={tileId => setActiveTile(tileId)}
        onSelectBundle={bundleId => setActiveTile(null, bundleId)}
        onZlayerChange={setZlayer}
      />
    </div>

    {/* Center: Map canvas */}
    <MapEditorCanvas
      key={`${state.mapId}-${state.viewMode}-${state.activeInteriorId ?? ''}`}
      configData={state.configData}
      tool={state.tool}
      showGrid={showGrid}
      showQuestItems={showQuestItems}
      selectedEntity={state.selectedEntity}
      viewMode={state.viewMode}
      activeInteriorId={state.activeInteriorId}
      activeTileId={state.activeTileId}
      activeBundleId={state.activeBundleId}
      activeZlayer={state.activeZlayer}
      onSelectEntity={selectEntity}
      onPlaceDecor={placeDecor}
      onMoveEntity={handleMoveEntity}
      onDeleteEntity={handleDeleteEntity}
      onAddStreet={addStreet}
      questPickupItems={questDefsData?.pickupItems ?? []}
    />

    {/* Right: Inspector */}
    <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <EntityInspector
        selectedEntity={state.selectedEntity}
        configData={state.configData}
        activeInteriorId={state.activeInteriorId}
        viewMode={state.viewMode}
        onDelete={handleDeleteEntity}
        onMoveEntity={handleMoveEntity}
        onZlayerChange={updateDecorZlayer}
        onDialogueChange={updateNpcDialogue}
        onOpenInterior={openInterior}
        onCloseInterior={closeInterior}
        onUpdateStreetEntry={updateStreetEntry}
        questPickupItems={questDefsData?.pickupItems ?? []}
      />
    </div>
  </div>

  {/* Drawer */}
  {drawerOpen && (
    <>
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        style={{
          height: 5, cursor: 'row-resize', background: '#1e1e3e', flexShrink: 0,
          borderTop: '1px solid #333',
        }}
      />
      <div style={{ height: drawerHeight, flexShrink: 0, overflow: 'hidden' }}>
        <NpcQuestDrawer
          tab={drawerTab}
          focusedNpcIndex={focusedNpcIndex}
          configData={state.configData}
          questDefsData={questDefsData ?? { quests: [] }}
          onTabChange={setDrawerTab}
          onUpdateNpc={updateNpc}
          onQuestDefsChange={setQuestDefsData}
        />
      </div>
    </>
  )}
</div>
```

Pass the new props to `MapEditorToolbar`:

```tsx
<MapEditorToolbar
  mapId={state.mapId}
  tool={state.tool}
  canUndo={state.undoStack.length > 0}
  canRedo={state.redoStack.length > 0}
  isDirty={state.isDirty}
  showGrid={showGrid}
  showQuestItems={showQuestItems}
  configData={state.configData}
  onMapChange={setMapId}
  onToolChange={setTool}
  onUndo={undo}
  onRedo={redo}
  onGridToggle={() => setShowGrid(g => !g)}
  onQuestItemsToggle={() => setShowQuestItems(q => !q)}
  questDefsData={questDefsData as Record<string, unknown> | null}
  onSaved={markSaved}
  drawerOpen={drawerOpen}
  onDrawerToggle={() => setDrawerOpen(o => !o)}
  hasDuplicateQuestIds={hasDuplicateQuestIds}
/>
```

Note: `setQuestDefsData` is used directly as `onQuestDefsChange` — its type is `React.Dispatch<React.SetStateAction<QuestDefsJson | null>>`. Since `NpcQuestDrawer` expects `(updater: (prev: QuestDefsJson) => QuestDefsJson) => void`, pass a wrapper:

```typescript
const handleQuestDefsChange = useCallback(
  (updater: (prev: QuestDefsJson) => QuestDefsJson) => {
    setQuestDefsData(prev => prev ? updater(prev) : prev)
  },
  [],
)
```

And use `onQuestDefsChange={handleQuestDefsChange}` in `NpcQuestDrawer`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/mapEditor/MapEditor.tsx \
        web/src/components/mapEditor/MapEditorToolbar.tsx
git commit -m "feat(map-editor): integrate NpcQuestDrawer into map editor layout"
```

---

## Self-review checklist

After all tasks are complete, verify manually in the browser:

- [ ] Toolbar `⚇` button opens/closes the drawer
- [ ] Drawer shows NPC tab by default; tab bar switches between NPCs / Quests
- [ ] Clicking an NPC on the canvas opens the drawer, scrolls to and expands that NPC row
- [ ] All NPC fields are editable; changes are reflected on the canvas and mark the map dirty
- [ ] Undo (Ctrl+Z) reverses NPC field edits
- [ ] Quest list is correct for each map; `+ New Quest` creates a blank quest
- [ ] Editing a quest's giver NPC and clicking Apply sets `questGive` on that NPC (visible in NPC tab)
- [ ] Deleting a quest that has `giverNpcId` assigned clears `questGive` on that NPC; notice appears
- [ ] Duplicate quest ID shows inline error; toolbar Save button shows error instead of saving
- [ ] Drawer resize handle works by dragging up/down
- [ ] Save button saves both configData and questDefsData as before
