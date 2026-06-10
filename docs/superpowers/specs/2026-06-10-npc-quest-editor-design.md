# NPC / Quest Editor — Design Spec

**Date:** 2026-06-10  
**Status:** Approved  

---

## Overview

Add a bottom-panel drawer to the map editor that provides full CRUD editing for NPCs and quest definitions. The drawer is opened via a toolbar button and/or by clicking an NPC on the canvas, and contains two tabs: **NPCs** and **Quests**.

---

## Section 1 — Layout & Architecture

### Layout

`MapEditor.tsx` gains local state:
- `drawerOpen: boolean`
- `drawerTab: 'npcs' | 'quests'`
- `focusedNpcIndex: number | null`

When `drawerOpen` is true, the main body uses `flex-direction: column`. The canvas/inspector row takes ~60% height; `NpcQuestDrawer` takes ~40%. A drag handle between them lets the user resize the split.

The toolbar gains one new button — "⚇ NPCs & Quests" — that toggles `drawerOpen`.

Clicking an NPC on the canvas calls `onNpcFocus(index)` in `MapEditor`, which sets `drawerOpen: true`, `drawerTab: 'npcs'`, `focusedNpcIndex: index`. The drawer auto-scrolls to and expands that NPC.

### New file structure

```
web/src/components/mapEditor/npcQuestDrawer/
  NpcQuestDrawer.tsx         — outer shell, tab bar, resize handle
  NpcEditor.tsx              — NPC list + full field editor
  QuestEditor.tsx            — Quest list + full CRUD form
  npcQuestDrawerTypes.ts     — local form-state types
```

---

## Section 2 — NPC Editor

### List view

Scrollable list of all NPCs from `configData.npcs`. Each row shows: name, sprite ID, and a small indicator if `questGive` or `questReceive` is set. Clicking a row expands it inline.

### Full editor fields

| Field | Input |
|---|---|
| `id` | Read-only |
| `name` | Text input |
| `sprite` | Text input (+ sprite preview if resolvable) |
| `isGhost` | Checkbox |
| `questGive` | Dropdown of quest IDs from current map's `questDefsData`, clearable |
| `questReceive` | `RawNpc.questReceive` is `string \| string[]`; render as a multi-value tag input supporting 0–many quest IDs, clearable per entry |
| `building` | Text input (building ID) |
| `schedule` | Table of rows: startHour, endHour, location type toggle (exterior → tx/ty; interior → buildingId + tx/ty). Add/remove rows. |
| `homeBed` | Optional sub-form: buildingId, tx, ty |
| `innRumours` | List of `{id, text}` rows, add/remove |
| `dialogue` | Not in drawer — editing remains via the right inspector panel only |

### State

All NPC edits go through a new `updateNpc(index, partial: Partial<RawNpc>)` action in `useMapEditorState`. It merges the partial into the NPC and pushes an undo snapshot — same pattern as existing mutations.

The existing `onDialogueChange` in `EntityInspector` is kept as-is for the quick right-panel summary.

---

## Section 3 — Quest Editor

### List view

Scrollable list of quests from `questDefsData.quests`. Each row shows: title, type badge, giver NPC name. A **"+ New Quest"** button at the top creates a blank quest with a generated ID in the format `new-quest-{n}` where `n` is the lowest integer that produces a unique ID within the current map's quest list.

### Full editor fields

**Identity**
- `id` — editable text input; validated for uniqueness (inline error if duplicate, blocks save)
- `title` — text input
- `type` — dropdown: `fetch` / `chain` / `lost-items`
- `prerequisite` — dropdown of existing quest IDs in the current map, with a "— none —" option at the top (`string | undefined`, no type change to `HubQuestDef`)

**NPC Links**
- `giverNpcId` — dropdown of NPC IDs from current map's `configData.npcs`
- `receiverNpcId` — dropdown of NPC IDs, same source

Selecting a giver NPC writes `questGive: questId` back to that NPC via `updateNpc`. Selecting a receiver writes `questReceive`. This bidirectional link is applied on change.

**Dialogue**
- `offerDialogue` — textarea
- `completeDialogue` — textarea
- `activeDialogue` — single textarea if type is `fetch` or `lost-items`; key→value table if type is `chain` (rows auto-populated from step `key` values; adding/removing a step adds/removes the corresponding dialogue row)

**Steps**

List of step rows. Each row:
- `key` — text input
- `type` — toggle: `collect` / `deliver`
- If `collect`: `pickupIds` (comma-separated text input), `required` (number)
- If `deliver`: `targetNpcId` (dropdown of NPC IDs), `required` (number)

Rows can be added and removed.

**Reward**
- `crystals` — optional number input
- `friendship` — key→value table: NPC ID → friendship amount; add/remove rows
- `collectible` — optional sub-form: id, name, icon, desc
- `unlock` — optional text input

**Delete**

A delete button removes the quest from `questDefsData` and clears `questGive`/`questReceive` from any NPCs that reference it (via `updateNpc`), with a brief inline notice ("Cleared from N NPCs").

---

## Section 4 — Data Flow & Save

Two data sources remain separate:

| Data | Owner | Undo? |
|---|---|---|
| NPC array (name, sprite, schedule, questGive, etc.) | `configData` in `useMapEditorState` | Yes — via `updateNpc` |
| Quest definitions | `questDefsData` local state in `MapEditor` | No — same as today |

The bidirectional NPC↔quest link calls both: `updateNpc` for the NPC side and `setQuestDefsData` for the quest side — two separate updates from one user action.

Save is unchanged — the toolbar Save button calls `saveMap` for `configData` and `saveQuestDefs` for `questDefsData`, exactly as it does today.

---

## Section 5 — Error Handling & Edge Cases

| Case | Handling |
|---|---|
| Duplicate quest `id` | Inline red error under the field; blocks save |
| Delete quest with NPC refs | Auto-clear `questGive`/`questReceive` on affected NPCs; show "Cleared from N NPCs" notice in drawer |
| Delete NPC with quest refs | No change to `questDefsData` — `giverNpcId`/`receiverNpcId` may reference missing NPC (existing behavior, game handles it) |
| Empty required quest fields | `id`, `title`, `giverNpcId`, and ≥1 step required; highlight on save attempt, not on mid-edit |
| No quests for this map | Quest tab shows empty state: "No quests yet — click + New Quest to get started" |

---

## Out of Scope

- Editing `configData.pickupItems` / `questDefsData.pickupItems` — handled by existing canvas + inspector flow
- NPC creation or deletion from the drawer — NPCs are placed on the canvas; the drawer only edits existing ones
- Undo/redo for quest definition changes
