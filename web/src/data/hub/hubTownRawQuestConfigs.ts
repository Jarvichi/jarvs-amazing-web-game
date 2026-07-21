import rawQuestConfig from './ravenwatch/questDefs.json'
import ironholdkeep_quests from './ironholdkeep/questDefs.json'
import millhaven_quests from './millhaven/questDefs.json'
import thornwoodcamp_quests from './thornwoodcamp/questDefs.json'
import capitalcity_quests from './capitalcity/questDefs.json'
import royalpalace_quests from './royalpalace/questDefs.json'
import saltmereport_quests from './saltmereport/questDefs.json'
import gearford_quests from './gearford/questDefs.json'
import harrowfield_quests from './harrowfield/questDefs.json'
import appleford_quests from './appleford/questDefs.json'
import gravemoor_quests from './gravemoor/questDefs.json'
import hollowmere_quests from './hollowmere/questDefs.json'
import dreadspirecitadel_quests from './dreadspirecitadel/questDefs.json'
import { MapId, QuestDefsJson } from './hubWorldFactory'

/**
 * Statically imports every town's raw questDefs.json — only for the map
 * editor (Storybook-only, unreachable from the running game). Keep this the
 * *one* place that still eagerly imports these files: hubWorldFactory.ts
 * loads them dynamically for the production app (see getHubWorldData), and
 * mixing a static import of the same file back in would make Vite bundle it
 * back into the eager graph, undoing that split.
 */
export const QUEST_DEFS_BY_MAP: Record<MapId, QuestDefsJson> = {
  ravenwatch: rawQuestConfig as QuestDefsJson,
  millhaven: millhaven_quests as QuestDefsJson,
  ironholdkeep: ironholdkeep_quests as QuestDefsJson,
  thornwoodcamp: thornwoodcamp_quests as QuestDefsJson,
  capitalcity: capitalcity_quests as QuestDefsJson,
  royalpalace: royalpalace_quests as QuestDefsJson,
  saltmereport: saltmereport_quests as QuestDefsJson,
  gearford: gearford_quests as QuestDefsJson,
  harrowfield: harrowfield_quests as QuestDefsJson,
  appleford: appleford_quests as QuestDefsJson,
  gravemoor: gravemoor_quests as QuestDefsJson,
  hollowmere: hollowmere_quests as QuestDefsJson,
  dreadspirecitadel: dreadspirecitadel_quests as QuestDefsJson,
}
