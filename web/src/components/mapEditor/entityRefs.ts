// Reference-option builders for the searchable entity pickers in the map editor.
//
// Each builder returns a flat list of { value, label, group? } options. For the
// CURRENT town the live editor data is passed in (so just-added entities show);
// other towns are read from the static config / quest maps. Quests are
// cross-town by default (chains span towns); local entities (npc/building/
// interior/pickup) only include other towns when `crossTown` is set.

import type { MapId, QuestDefsJson } from '../../data/hub/hubWorldFactory'
import { QUEST_DEFS_BY_MAP } from '../../data/hub/hubWorldFactory'
import type { RawMapConfig } from './mapEditorTypes'
import { RAW_CONFIGS } from './useMapEditorState'

export interface RefOption {
  value: string
  label: string
  group?: string
}

export const TOWN_LABELS: Record<MapId, string> = {
  ravenwatch: 'Ravenwatch',
  millhaven: 'Millhaven',
  ironholdkeep: 'Ironhold Keep',
  thornwoodcamp: 'Thornwood Camp',
  capitalcity: 'Capital City',
  royalpalace: 'Royal Palace',
  saltmereport: 'Saltmere Port',
  gearford: 'Gearford',
  harrowfield: 'Harrowfield',
  appleford: 'Appleford',
  gravemoor: 'Gravemoor',
  hollowmere: 'Hollowmere',
  dreadspirecitadel: 'Dreadspire Citadel',
}

export function townLabel(map: MapId): string {
  return TOWN_LABELS[map] ?? map
}

const ALL_MAPS = Object.keys(TOWN_LABELS) as MapId[]

// Run `fn` for the current town (with the live data) and, when crossTown, for
// every other town (with static data). `group` is the town label, omitted for
// the current town so its entries read cleanly.
function eachTown<L, S>(
  currentMap: MapId,
  liveCurrent: L,
  staticFor: (map: MapId) => S,
  crossTown: boolean,
  emit: (data: L | S, group: string | undefined, isCurrent: boolean) => void,
) {
  emit(liveCurrent, undefined, true)
  if (!crossTown) return
  for (const map of ALL_MAPS) {
    if (map === currentMap) continue
    emit(staticFor(map), townLabel(map), false)
  }
}

type NpcLite = { id: string; name?: string }
type QuestLite = { id: string; title?: string }
type PickupLite = { id: string }
type BuildingLite = { id?: string }

function npcsOf(cfg: RawMapConfig | undefined): NpcLite[] { return (cfg?.npcs ?? []) as NpcLite[] }
function questsOf(q: QuestDefsJson | undefined): QuestLite[] { return ((q?.quests as QuestLite[] | undefined) ?? []) }
function pickupsOf(q: QuestDefsJson | undefined): PickupLite[] { return (q?.pickupItems ?? []) as PickupLite[] }
function dialoguesOf(q: QuestDefsJson | undefined): QuestLite[] { return ((q?.dialogues as QuestLite[] | undefined) ?? []) }

export function npcRefOptions(currentMap: MapId, currentNpcs: NpcLite[], crossTown = false): RefOption[] {
  const out: RefOption[] = []
  eachTown<NpcLite[], NpcLite[]>(currentMap, currentNpcs, m => npcsOf(RAW_CONFIGS[m]), crossTown, (npcs, group) => {
    for (const n of npcs) if (n.id) out.push({ value: n.id, label: n.name ? `${n.name} (${n.id})` : n.id, group })
  })
  return out
}

export function buildingRefOptions(currentMap: MapId, currentBuildings: BuildingLite[], crossTown = false): RefOption[] {
  const out: RefOption[] = []
  eachTown<BuildingLite[], BuildingLite[]>(currentMap, currentBuildings, m => (RAW_CONFIGS[m]?.buildings ?? []) as BuildingLite[], crossTown, (bs, group) => {
    for (const b of bs) if (b.id) out.push({ value: b.id, label: b.id, group })
  })
  return out
}

export function interiorRefOptions(currentMap: MapId, currentInteriors: Record<string, { name?: string }> | undefined, crossTown = false): RefOption[] {
  const out: RefOption[] = []
  eachTown(currentMap, currentInteriors ?? {}, m => (RAW_CONFIGS[m]?.interiors ?? {}) as Record<string, { name?: string }>, crossTown, (ints, group) => {
    for (const [id, i] of Object.entries(ints)) out.push({ value: id, label: i?.name ? `${i.name} (${id})` : id, group })
  })
  return out
}

export function pickupRefOptions(currentMap: MapId, currentPickups: PickupLite[], crossTown = false): RefOption[] {
  const out: RefOption[] = []
  eachTown<PickupLite[], PickupLite[]>(currentMap, currentPickups, m => pickupsOf(QUEST_DEFS_BY_MAP[m]), crossTown, (ps, group) => {
    for (const p of ps) if (p.id) out.push({ value: p.id, label: p.id, group })
  })
  return out
}

export function questRefOptions(currentMap: MapId, currentQuests: QuestLite[], crossTown = true): RefOption[] {
  const out: RefOption[] = []
  eachTown<QuestLite[], QuestLite[]>(currentMap, currentQuests, m => questsOf(QUEST_DEFS_BY_MAP[m]), crossTown, (qs, group) => {
    for (const q of qs) if (q.id) out.push({ value: q.id, label: q.title ? `${q.title} (${q.id})` : q.id, group })
  })
  return out
}

export function dialogueTreeRefOptions(currentMap: MapId, currentDialogues: QuestLite[], crossTown = false): RefOption[] {
  const out: RefOption[] = []
  eachTown<QuestLite[], QuestLite[]>(currentMap, currentDialogues, m => dialoguesOf(QUEST_DEFS_BY_MAP[m]), crossTown, (ds, group) => {
    for (const d of ds) if (d.id) out.push({ value: d.id, label: d.id, group })
  })
  return out
}

/** Town that defines a given quest id (for cross-town badges). */
export function townOfQuest(questId: string): MapId | undefined {
  for (const map of ALL_MAPS) {
    if (questsOf(QUEST_DEFS_BY_MAP[map]).some(q => q.id === questId)) return map
  }
  return undefined
}
