import { createHubLocationData, createHubQuestData, HubLocationBundle, HubQuestBundle } from "./loader";
import ravenwatch_config from './ravenwatch/config.json' 
import rawQuestConfig from './ravenwatch/questDefs.json'

import ironholdkeep_config from './ironholdkeep/config.json'
import ironholdkeep_quests from './ironholdkeep/questDefs.json'

import millhaven_config from './millhaven/config.json'
import millhaven_quests from './millhaven/questDefs.json'
import { HubQuestDef } from "./questDefs";


export interface RawQuestPickupItem {
  id: string
  tx: number
  ty: number
  tileId: string
  questId?: string
  building?: string
  chain?: string
  requireTouch?: boolean
}
export type MapId = 'ravenwatch' | 'ironholdkeep' | 'millhaven'
export type QuestDefsJson = { pickupItems?: RawQuestPickupItem[]; [key: string]: unknown }
export const QUEST_DEFS_BY_MAP: Record<MapId, QuestDefsJson> = {
  ravenwatch: rawQuestConfig as QuestDefsJson,
  millhaven: millhaven_quests as  QuestDefsJson,
    ironholdkeep: ironholdkeep_quests as QuestDefsJson,

}


export const RAVENWATCH = createHubLocationData(ravenwatch_config)
export const IRONHOLDKEEP = createHubLocationData(ironholdkeep_config)
export const MILLHAVE = createHubLocationData(millhaven_config)

export const RAVENWATCH_QUESTS = createHubQuestData(rawQuestConfig)
export const IRONHOLDKEEP_QUESTS  = createHubQuestData(ironholdkeep_quests)
export const MILLHAVE_QUESTS  = createHubQuestData(millhaven_quests)


export const ALL_QUESTS : HubQuestBundle = {
    HUB_QUEST_DEFS: [  
          ... RAVENWATCH_QUESTS.HUB_QUEST_DEFS,
    ... IRONHOLDKEEP_QUESTS.HUB_QUEST_DEFS,
    ... MILLHAVE_QUESTS.HUB_QUEST_DEFS,
    ],
  INN_RUMOURS: [  
      ... RAVENWATCH_QUESTS.INN_RUMOURS ?? [],
    ... IRONHOLDKEEP_QUESTS.INN_RUMOURS ?? [],
    ... MILLHAVE_QUESTS.INN_RUMOURS ?? [],
  ],
  FRIENDSHIP_DIALOGUE:{ 
       ... RAVENWATCH_QUESTS.FRIENDSHIP_DIALOGUE,
    ... IRONHOLDKEEP_QUESTS.FRIENDSHIP_DIALOGUE,
    ... MILLHAVE_QUESTS.FRIENDSHIP_DIALOGUE,
 },
  HUB_PICKUP_ITEMS:[  
       ... RAVENWATCH_QUESTS.HUB_PICKUP_ITEMS,
    ... IRONHOLDKEEP_QUESTS.HUB_PICKUP_ITEMS,
    ... MILLHAVE_QUESTS.HUB_PICKUP_ITEMS,
  ],
  HUB_BLOCKED_PATHS:[ 
       ... RAVENWATCH_QUESTS.HUB_BLOCKED_PATHS,
    ...IRONHOLDKEEP_QUESTS.HUB_BLOCKED_PATHS,
    ...MILLHAVE_QUESTS.HUB_BLOCKED_PATHS,
  ],
}

export const ALL_QUEST_DEFS = [
  ...Object.values(ALL_QUESTS.HUB_QUEST_DEFS).flat(),
]


export const FRIENDSHIP_DIALOGUE = {
  ...RAVENWATCH_QUESTS.FRIENDSHIP_DIALOGUE,
  ...IRONHOLDKEEP_QUESTS.FRIENDSHIP_DIALOGUE,
  ...MILLHAVE_QUESTS.FRIENDSHIP_DIALOGUE,
}

export interface LocationEntry {
  locationData: HubLocationBundle
  locationQuests: HubQuestBundle
  questDefs:    HubQuestDef[]
}

// Maps locationKey → data bundle.
// To add a new location: create web/src/data/<key>/ with config.json + questDefs.json + loader.ts,
// then add one entry here.
export const LOCATION_REGISTRY: Record<string, LocationEntry> = {
  'ravenwatch':    { locationData: RAVENWATCH,  locationQuests: RAVENWATCH_QUESTS,  questDefs: RAVENWATCH_QUESTS.HUB_QUEST_DEFS },
  'ironhold-keep': { locationData: IRONHOLDKEEP, locationQuests:IRONHOLDKEEP_QUESTS, questDefs: IRONHOLDKEEP_QUESTS.HUB_QUEST_DEFS },
  'millhaven':     { locationData: MILLHAVE, locationQuests:MILLHAVE_QUESTS, questDefs: MILLHAVE_QUESTS.HUB_QUEST_DEFS },
}
