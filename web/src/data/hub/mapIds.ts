// The canonical, lowercase-hyphenated town-id space, and their display names.
// Deliberately zero-dependency (no imports) — loader.ts needs MapId for
// NpcScheduleEntry's 'travel' location type, and hubWorldFactory.ts already
// imports from loader.ts, so a shared, dependency-free home for MapId avoids
// a circular import between the two.

export type MapId =
  | 'ravenwatch'
  | 'ironholdkeep'
  | 'millhaven'
  | 'thornwoodcamp'
  | 'capitalcity'
  | 'royalpalace'
  | 'saltmereport'
  | 'gearford'
  | 'harrowfield'
  | 'appleford'
  | 'gravemoor'
  | 'hollowmere'
  | 'dreadspirecitadel'

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
