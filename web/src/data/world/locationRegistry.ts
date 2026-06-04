import type { HubLocationData } from '../hub/locationTypes'
import type { HubQuestDef } from '../hub/questDefs'
import { HUB_LOCATION_DATA } from '../hub/loader'
import { HUB_QUEST_DEFS } from '../hub/questDefs'
import { CASTLE_LOCATION_DATA, CASTLE_QUEST_DEFS } from '../castle/loader'
import { TOWN2_LOCATION_DATA, TOWN2_QUEST_DEFS } from '../town2/loader'

export interface LocationEntry {
  locationData: HubLocationData
  questDefs:    HubQuestDef[]
}

// Maps locationKey → data bundle.
// To add a new location: create web/src/data/<key>/ with config.json + questDefs.json + loader.ts,
// then add one entry here.
export const LOCATION_REGISTRY: Record<string, LocationEntry> = {
  'ravenwatch':    { locationData: HUB_LOCATION_DATA,    questDefs: HUB_QUEST_DEFS },
  'ironhold-keep': { locationData: CASTLE_LOCATION_DATA, questDefs: CASTLE_QUEST_DEFS },
  'millhaven':     { locationData: TOWN2_LOCATION_DATA,  questDefs: TOWN2_QUEST_DEFS },
}
