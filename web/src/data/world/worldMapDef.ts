import { WORLD_DECOR } from '../tiles/worldTileIndex'

export type WorldNodeType = 'town' | 'castle' | 'battle' | 'camp' | 'cave' | 'port'

export interface WorldNodeDef {
  id:              string
  type:            WorldNodeType
  name:            string
  x:               number
  y:               number
  connections:     string[]
  requiredClears?: string[]
  locationKey?:    string
  battleConfig?:   { actId: string; nodeId: string }
  decorTiles:      number[]
  decorOffsets?:   [number, number][]
}

// World map canvas: 700×520 px
// Ravenwatch is at the bottom-centre; new nodes can be added anywhere.
export const WORLD_MAP_NODES: WorldNodeDef[] = [
  {
    id:          'ravenwatch',
    type:        'town',
    name:        'Ravenwatch',
    x:           350,
    y:           450,
    connections: ['forest-path', 'bridge-battle'],
    locationKey: 'ravenwatch',
    decorTiles:  [WORLD_DECOR.villageLeft, WORLD_DECOR.villageRight],
    decorOffsets:[[-32, -16], [0, -16]],
  },
  {
    id:            'forest-path',
    type:          'battle',
    name:          'Forest Path',
    x:             210,
    y:             360,
    connections:   ['ironhold-keep'],
    requiredClears:[], // available from start
    battleConfig:  { actId: 'act1', nodeId: 'n1' },
    decorTiles:    [WORLD_DECOR.groupOfTrees],
  },
  {
    id:            'bridge-battle',
    type:          'battle',
    name:          'Bridge Battle',
    x:             490,
    y:             360,
    connections:   ['ironhold-keep'],
    requiredClears:[], // available from start
    battleConfig:  { actId: 'act1', nodeId: 'n2' },
    decorTiles:    [WORLD_DECOR.stoneBridgeHTop],
  },
  {
    id:            'ironhold-keep',
    type:          'castle',
    name:          'Ironhold Keep',
    x:             350,
    y:             270,
    connections:   ['thornwood-camp'],
    requiredClears:['forest-path|bridge-battle'],
    locationKey:   'ironhold-keep',
    decorTiles:    [WORLD_DECOR.squareCastleTopLeft, WORLD_DECOR.squareCastleTopRight,
                    WORLD_DECOR.squareCastleBottomLeft, WORLD_DECOR.squareCastleBottomRight],
    decorOffsets:  [[-32, -32], [0, -32], [-32, 0], [0, 0]],
  },
  {
    id:            'thornwood-camp',
    type:          'camp',
    name:          'Thornwood Camp',
    x:             350,
    y:             185,
    connections:   ['river-battle'],
    requiredClears:['ironhold-keep'],
    decorTiles:    [WORLD_DECOR.singleTree, WORLD_DECOR.rock],
    decorOffsets:  [[-20, -16], [8, -8]],
  },
  {
    id:            'river-battle',
    type:          'battle',
    name:          'River Crossing',
    x:             350,
    y:             105,
    connections:   ['millhaven'],
    requiredClears:['thornwood-camp'],
    battleConfig:  { actId: 'act2', nodeId: 'n1' },
    decorTiles:    [WORLD_DECOR.woodenBridgeHTop],
  },
  {
    id:            'millhaven',
    type:          'town',
    name:          'Millhaven',
    x:             350,
    y:             30,
    connections:   [],
    requiredClears:['river-battle'],
    locationKey:   'millhaven',
    decorTiles:    [WORLD_DECOR.walledTownLeft, WORLD_DECOR.walledTownRight],
    decorOffsets:  [[-32, -16], [0, -16]],
  },
]
