import { createHubLocationData, createHubQuestData, HubLocationBundle, HubQuestBundle } from "./loader";
import type { RawConfig } from './config'
import { HubQuestDef, RawQuestConfig } from "./questDefs";
import type { MapId } from './mapIds'

export interface RawQuestPickupItem {
  id: string
  tx: number
  ty: number
  tileId: string
  /** Extra visual-only tiles offset from (tx, ty) — e.g. a lantern split across
   *  a top/bottom tile pair. Share the primary tile's collection/visibility. */
  extraTiles?: Array<{ dx: number; dy: number; tileId: string }>
  questId?: string
  building?: string
  chain?: string
  requireTouch?: boolean
  glow?: boolean
  glowRadius?: number
  pulse?: boolean
}
export type { MapId } from './mapIds'
export type QuestDefsJson = { pickupItems?: RawQuestPickupItem[]; [key: string]: unknown }

export interface LocationEntry {
  locationData: HubLocationBundle
  locationQuests: HubQuestBundle
  questDefs: HubQuestDef[]
}

export interface HubWorldData {
  /** Maps locationKey (used by App.tsx/world-map nodes) → data bundle. */
  locationRegistry: Record<string, LocationEntry>
  allQuests: HubQuestBundle
  allQuestDefs: HubQuestDef[]
  friendshipDialogue: HubQuestBundle['FRIENDSHIP_DIALOGUE']
  relationshipDialogue: HubQuestBundle['RELATIONSHIP_DIALOGUE']
}

// Every town's config.json/questDefs.json is dynamically imported and
// aggregated on first use (see getHubWorldData) rather than statically
// imported up front — this data (~1.5MB combined across 13 towns) is only
// needed once a player actually opens the hub world, not at app boot.
// To add a new location: create web/src/data/<key>/ with config.json +
// questDefs.json + loader.ts, then add one entry to CONFIG_LOADERS,
// QUEST_LOADERS, and LOCATION_KEY_BY_MAP_ID below.

const CONFIG_LOADERS: Record<MapId, () => Promise<{ default: RawConfig }>> = {
  ravenwatch:        () => import('./ravenwatch/config.json'),
  ironholdkeep:      () => import('./ironholdkeep/config.json'),
  millhaven:         () => import('./millhaven/config.json'),
  thornwoodcamp:     () => import('./thornwoodcamp/config.json'),
  capitalcity:       () => import('./capitalcity/config.json'),
  royalpalace:       () => import('./royalpalace/config.json'),
  saltmereport:      () => import('./saltmereport/config.json'),
  gearford:          () => import('./gearford/config.json'),
  harrowfield:       () => import('./harrowfield/config.json'),
  appleford:         () => import('./appleford/config.json'),
  gravemoor:         () => import('./gravemoor/config.json'),
  hollowmere:        () => import('./hollowmere/config.json'),
  dreadspirecitadel: () => import('./dreadspirecitadel/config.json'),
}

const QUEST_LOADERS: Record<MapId, () => Promise<{ default: RawQuestConfig }>> = {
  ravenwatch:        () => import('./ravenwatch/questDefs.json'),
  ironholdkeep:      () => import('./ironholdkeep/questDefs.json'),
  millhaven:         () => import('./millhaven/questDefs.json'),
  thornwoodcamp:     () => import('./thornwoodcamp/questDefs.json'),
  capitalcity:       () => import('./capitalcity/questDefs.json'),
  royalpalace:       () => import('./royalpalace/questDefs.json'),
  saltmereport:      () => import('./saltmereport/questDefs.json'),
  gearford:          () => import('./gearford/questDefs.json'),
  harrowfield:       () => import('./harrowfield/questDefs.json'),
  appleford:         () => import('./appleford/questDefs.json'),
  gravemoor:         () => import('./gravemoor/questDefs.json'),
  hollowmere:        () => import('./hollowmere/questDefs.json'),
  dreadspirecitadel: () => import('./dreadspirecitadel/questDefs.json'),
}

/** locationKey (App.tsx/world-map convention) for each MapId. */
export const LOCATION_KEY_BY_MAP_ID: Record<MapId, string> = {
  ravenwatch:        'ravenwatch',
  ironholdkeep:      'ironhold-keep',
  millhaven:         'millhaven',
  thornwoodcamp:     'thornwood-camp',
  capitalcity:       'capital-city',
  royalpalace:       'royal-palace',
  saltmereport:      'saltmere-port',
  gearford:          'gearford',
  harrowfield:       'harrowfield',
  appleford:         'appleford',
  gravemoor:         'gravemoor',
  hollowmere:        'hollowmere',
  dreadspirecitadel: 'dreadspire-citadel',
}

const MAP_IDS = Object.keys(CONFIG_LOADERS) as MapId[]

let cachedData: HubWorldData | undefined
let pendingData: Promise<HubWorldData> | undefined

/** Loads (and caches) every town's hub data, aggregated. Cheap on repeat calls. */
export function getHubWorldData(): Promise<HubWorldData> {
  if (cachedData) return Promise.resolve(cachedData)
  if (!pendingData) {
    pendingData = Promise.all(
      MAP_IDS.map(async mapId => {
        const [configModule, questModule] = await Promise.all([CONFIG_LOADERS[mapId](), QUEST_LOADERS[mapId]()])
        return {
          mapId,
          locationData: createHubLocationData(configModule.default),
          locationQuests: createHubQuestData(questModule.default),
        }
      }),
    ).then(results => {
      const locationRegistry: Record<string, LocationEntry> = {}
      const bundles: HubQuestBundle[] = []
      for (const { mapId, locationData, locationQuests } of results) {
        bundles.push(locationQuests)
        locationRegistry[LOCATION_KEY_BY_MAP_ID[mapId]] = {
          locationData, locationQuests, questDefs: locationQuests.HUB_QUEST_DEFS,
        }
      }

      const allQuests: HubQuestBundle = {
        HUB_QUEST_DEFS:        bundles.flatMap(b => b.HUB_QUEST_DEFS),
        FRIENDSHIP_DIALOGUE:   Object.assign({}, ...bundles.map(b => b.FRIENDSHIP_DIALOGUE)),
        RELATIONSHIP_DIALOGUE: Object.assign({}, ...bundles.map(b => b.RELATIONSHIP_DIALOGUE)),
        HUB_PICKUP_ITEMS:      bundles.flatMap(b => b.HUB_PICKUP_ITEMS),
        HUB_BLOCKED_PATHS:     bundles.flatMap(b => b.HUB_BLOCKED_PATHS),
        HUB_DIALOGUES:         Object.assign({}, ...bundles.map(b => b.HUB_DIALOGUES)),
        HUB_CONVERSATION_TOPICS: Object.assign({}, ...bundles.map(b => b.HUB_CONVERSATION_TOPICS)),
      }

      const data: HubWorldData = {
        locationRegistry,
        allQuests,
        allQuestDefs: [...allQuests.HUB_QUEST_DEFS],
        friendshipDialogue: { ...allQuests.FRIENDSHIP_DIALOGUE },
        relationshipDialogue: { ...allQuests.RELATIONSHIP_DIALOGUE },
      }
      cachedData = data
      return data
    })
  }
  return pendingData
}

/** Synchronous, no-fetch read of already-loaded hub data. Undefined if not loaded yet. */
export function peekHubWorldData(): HubWorldData | undefined {
  return cachedData
}
