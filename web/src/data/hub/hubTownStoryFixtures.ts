// Eagerly-built hub town fixtures for Storybook stories and tests only.
//
// hubWorldFactory.ts loads every town's data dynamically (see getHubWorldData)
// so the production app doesn't pay for all 13 towns' JSON at boot. Stories
// need synchronous, already-resolved data at module-eval time, which the async
// API can't provide — so this file keeps the old eager-import-and-build
// approach, isolated here where it can't leak into the app's boot bundle
// (nothing under src/components or src/App.tsx imports this file).
import { createHubLocationData, createHubQuestData, HubQuestBundle } from './loader'
import ravenwatch_config from './ravenwatch/config.json'
import ravenwatch_quests from './ravenwatch/questDefs.json'
import ironholdkeep_config from './ironholdkeep/config.json'
import ironholdkeep_quests from './ironholdkeep/questDefs.json'
import millhaven_config from './millhaven/config.json'
import millhaven_quests from './millhaven/questDefs.json'
import thornwoodcamp_config from './thornwoodcamp/config.json'
import thornwoodcamp_quests from './thornwoodcamp/questDefs.json'
import capitalcity_config from './capitalcity/config.json'
import capitalcity_quests from './capitalcity/questDefs.json'
import royalpalace_config from './royalpalace/config.json'
import royalpalace_quests from './royalpalace/questDefs.json'
import saltmereport_config from './saltmereport/config.json'
import saltmereport_quests from './saltmereport/questDefs.json'
import gearford_config from './gearford/config.json'
import gearford_quests from './gearford/questDefs.json'
import harrowfield_config from './harrowfield/config.json'
import harrowfield_quests from './harrowfield/questDefs.json'
import appleford_config from './appleford/config.json'
import appleford_quests from './appleford/questDefs.json'
import gravemoor_config from './gravemoor/config.json'
import gravemoor_quests from './gravemoor/questDefs.json'
import hollowmere_config from './hollowmere/config.json'
import hollowmere_quests from './hollowmere/questDefs.json'
import dreadspirecitadel_config from './dreadspirecitadel/config.json'
import dreadspirecitadel_quests from './dreadspirecitadel/questDefs.json'
import { LocationEntry } from './hubWorldFactory'

export const RAVENWATCH = createHubLocationData(ravenwatch_config)
export const IRONHOLDKEEP = createHubLocationData(ironholdkeep_config)
export const MILLHAVE = createHubLocationData(millhaven_config)
export const THORNWOODCAMP = createHubLocationData(thornwoodcamp_config)
export const CAPITALCITY = createHubLocationData(capitalcity_config)
export const ROYALPALACE = createHubLocationData(royalpalace_config)
export const SALTMEREPORT = createHubLocationData(saltmereport_config)
export const GEARFORD = createHubLocationData(gearford_config)
export const HARROWFIELD = createHubLocationData(harrowfield_config)
export const APPLEFORD = createHubLocationData(appleford_config)
export const GRAVEMOOR = createHubLocationData(gravemoor_config)
export const HOLLOWMERE = createHubLocationData(hollowmere_config)
export const DREADSPIRECITADEL = createHubLocationData(dreadspirecitadel_config)

export const RAVENWATCH_QUESTS = createHubQuestData(ravenwatch_quests)
export const IRONHOLDKEEP_QUESTS = createHubQuestData(ironholdkeep_quests)
export const MILLHAVE_QUESTS = createHubQuestData(millhaven_quests)
export const THORNWOODCAMP_QUESTS = createHubQuestData(thornwoodcamp_quests)
export const CAPITALCITY_QUESTS = createHubQuestData(capitalcity_quests)
export const ROYALPALACE_QUESTS = createHubQuestData(royalpalace_quests)
export const SALTMEREPORT_QUESTS = createHubQuestData(saltmereport_quests)
export const GEARFORD_QUESTS = createHubQuestData(gearford_quests)
export const HARROWFIELD_QUESTS = createHubQuestData(harrowfield_quests)
export const APPLEFORD_QUESTS = createHubQuestData(appleford_quests)
export const GRAVEMOOR_QUESTS = createHubQuestData(gravemoor_quests)
export const HOLLOWMERE_QUESTS = createHubQuestData(hollowmere_quests)
export const DREADSPIRECITADEL_QUESTS = createHubQuestData(dreadspirecitadel_quests)

const ALL_QUEST_BUNDLES: HubQuestBundle[] = [
  RAVENWATCH_QUESTS, IRONHOLDKEEP_QUESTS, MILLHAVE_QUESTS, THORNWOODCAMP_QUESTS,
  CAPITALCITY_QUESTS, ROYALPALACE_QUESTS, SALTMEREPORT_QUESTS, GEARFORD_QUESTS,
  HARROWFIELD_QUESTS, APPLEFORD_QUESTS, GRAVEMOOR_QUESTS, HOLLOWMERE_QUESTS,
  DREADSPIRECITADEL_QUESTS,
]

export const ALL_QUESTS: HubQuestBundle = {
  HUB_QUEST_DEFS: ALL_QUEST_BUNDLES.flatMap(b => b.HUB_QUEST_DEFS),
  FRIENDSHIP_DIALOGUE: Object.assign({}, ...ALL_QUEST_BUNDLES.map(b => b.FRIENDSHIP_DIALOGUE)),
  RELATIONSHIP_DIALOGUE: Object.assign({}, ...ALL_QUEST_BUNDLES.map(b => b.RELATIONSHIP_DIALOGUE)),
  HUB_PICKUP_ITEMS: ALL_QUEST_BUNDLES.flatMap(b => b.HUB_PICKUP_ITEMS),
  HUB_BLOCKED_PATHS: ALL_QUEST_BUNDLES.flatMap(b => b.HUB_BLOCKED_PATHS),
  HUB_DIALOGUES: Object.assign({}, ...ALL_QUEST_BUNDLES.map(b => b.HUB_DIALOGUES)),
}

export const ALL_QUEST_DEFS = [...ALL_QUESTS.HUB_QUEST_DEFS]
export const FRIENDSHIP_DIALOGUE = { ...ALL_QUESTS.FRIENDSHIP_DIALOGUE }
export const RELATIONSHIP_DIALOGUE = { ...ALL_QUESTS.RELATIONSHIP_DIALOGUE }

export const LOCATION_REGISTRY: Record<string, LocationEntry> = {
  'ravenwatch':         { locationData: RAVENWATCH,          locationQuests: RAVENWATCH_QUESTS,          questDefs: RAVENWATCH_QUESTS.HUB_QUEST_DEFS },
  'ironhold-keep':      { locationData: IRONHOLDKEEP,        locationQuests: IRONHOLDKEEP_QUESTS,        questDefs: IRONHOLDKEEP_QUESTS.HUB_QUEST_DEFS },
  'millhaven':          { locationData: MILLHAVE,            locationQuests: MILLHAVE_QUESTS,            questDefs: MILLHAVE_QUESTS.HUB_QUEST_DEFS },
  'thornwood-camp':     { locationData: THORNWOODCAMP,       locationQuests: THORNWOODCAMP_QUESTS,       questDefs: THORNWOODCAMP_QUESTS.HUB_QUEST_DEFS },
  'capital-city':       { locationData: CAPITALCITY,         locationQuests: CAPITALCITY_QUESTS,         questDefs: CAPITALCITY_QUESTS.HUB_QUEST_DEFS },
  'royal-palace':       { locationData: ROYALPALACE,         locationQuests: ROYALPALACE_QUESTS,         questDefs: ROYALPALACE_QUESTS.HUB_QUEST_DEFS },
  'saltmere-port':      { locationData: SALTMEREPORT,        locationQuests: SALTMEREPORT_QUESTS,        questDefs: SALTMEREPORT_QUESTS.HUB_QUEST_DEFS },
  'gearford':           { locationData: GEARFORD,            locationQuests: GEARFORD_QUESTS,            questDefs: GEARFORD_QUESTS.HUB_QUEST_DEFS },
  'harrowfield':        { locationData: HARROWFIELD,         locationQuests: HARROWFIELD_QUESTS,         questDefs: HARROWFIELD_QUESTS.HUB_QUEST_DEFS },
  'appleford':          { locationData: APPLEFORD,           locationQuests: APPLEFORD_QUESTS,           questDefs: APPLEFORD_QUESTS.HUB_QUEST_DEFS },
  'gravemoor':          { locationData: GRAVEMOOR,           locationQuests: GRAVEMOOR_QUESTS,           questDefs: GRAVEMOOR_QUESTS.HUB_QUEST_DEFS },
  'hollowmere':         { locationData: HOLLOWMERE,          locationQuests: HOLLOWMERE_QUESTS,          questDefs: HOLLOWMERE_QUESTS.HUB_QUEST_DEFS },
  'dreadspire-citadel': { locationData: DREADSPIRECITADEL,   locationQuests: DREADSPIRECITADEL_QUESTS,   questDefs: DREADSPIRECITADEL_QUESTS.HUB_QUEST_DEFS },
}
