// ─── /adventure: maps, quests and how they're built ─────────────────────────
//
// Each land (emberfall.ts, …) is a quest plus its content: an overworld drawn
// as one big grid, dungeons built from a room list, a door list and a few
// interior layouts, and caves built from a template. maps.test.ts walks every
// land with the item gates and proves each quest can be finished.
//
// Tiles (see tiles.ts for what can be walked on):
//   .  grass      ,  path       F  flowers    A  ash        =  bridge
//   T  tree       a  dead tree  R  rock       M  mountain   g  grave
//   W  deep water w  shallows (heron boots)  ~  lava       B  bush (sword)
//   X  thorns (ember rod)      C  cracked rock (bombs)     D  doorway
//   h  roof       H  house wall Q  keep wall  K  ashen gate (three flames)
//   :  dungeon floor           #  dungeon wall             s  statue
//   o  brazier    L  locked door (key)        S  shutter (clear the room)
//   ;  cave floor _  nothing
//   O  boulder (iron gloves)  V  chasm      P  grapple post  I  ice

import { RH, RW } from './tiles'
import { EMBERFALL } from './emberfall'
import { FROSTREACH } from './frostreach'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type EnemyKind = 'blob' | 'beetle' | 'thornling' | 'boar' | 'bat' | 'wisp' | 'knight' | 'iceblob' | 'yeti' | 'wolf'
export type BossKind = 'mossback' | 'drake' | 'serpent' | 'king' | 'rimefang' | 'stormcrow' | 'glasseye' | 'warden'
export type ItemKind =
  | 'sword' | 'bombs' | 'rod' | 'boots' | 'heart' | 'flame' | 'key' | 'potion' | 'coins' | 'bombPack' | 'gloves' | 'grapple' | 'shield'
export type Look = 'smith' | 'elder' | 'villager' | 'kid' | 'sage' | 'merchant' | 'captain'

export interface Npc {
  /** Tile position within the room (fractions allowed). */
  x: number
  y: number
  look: Look
  lines: string[]
  /** Points the way to the next goal (after their own lines, the first time). */
  guide?: boolean
  /** A ship's captain: after their lines, sails you to `to` — once `needs` is flagged (else says `wait`). */
  ferry?: { to: Warp; needs?: string; wait?: string[] }
}

export interface ShopItem { item: ItemKind; price: number }

export interface RoomDef {
  enemies?: EnemyKind[]
  boss?: BossKind
  /** A key lying in the room, or dropped when the room is cleared. */
  key?: 'floor' | 'clear'
  /** A treasure, shown once the room's enemies are gone. */
  item?: ItemKind
  npcs?: Npc[]
  /** Said on entering (caves). */
  talk?: string[]
  shop?: ShopItem[]
}

export interface Warp { map: string; x: number; y: number; dir: Dir }

export interface GameMap {
  id: string
  name: string
  kind: 'overworld' | 'dungeon' | 'cave'
  /** Size in rooms. */
  cols: number
  rows: number
  tiles: string[]
  /** What an opened wall, burnt thorn or unlocked door turns into. */
  floor: string
  /** "tx,ty" of a doorway → where it leads. */
  warps: Record<string, Warp>
  /** "tx,ty" → group; tiles of one group open together (both halves of a door). */
  groups: Record<string, string>
  /** "rx,ry" → contents. */
  rooms: Record<string, RoomDef>
  music: 'overworld' | 'frost' | 'dungeon' | 'keep' | 'cave'
  /** The quest this map belongs to. */
  quest: QuestId
  /** Overworld look: the default theme, and themes for some rooms ("rx,ry"). */
  theme?: string
  regions?: Record<string, string[]>
}

// ── Quests ──────────────────────────────────────────────────────────────────
export type QuestId = 'emberfall' | 'frostreach'

/** Gear a quest step can ask for (fields of the inventory). */
export type Gear = 'sword' | 'hasBombs' | 'rod' | 'boots' | 'gloves' | 'grapple' | 'shield'

export interface Step {
  id: string
  /** Done once this flag is set or this gear is carried. */
  need: { flag: string } | { have: Gear }
  /** The overworld screen the minimap marks. */
  room: [number, number] | null
  hint: string[]
}

export interface Quest {
  id: QuestId
  name: string
  /** Its overworld map; waking after a fall there puts you at `start`. */
  overworld: string
  start: Warp
  /** What each dungeon's boss guards, e.g. "HEARTH-FLAME". */
  flame: string
  /** The dungeons whose flames open the final gate ('K'), in order. */
  dungeons: string[]
  /** Beating this boss ends the quest. */
  final: { map: string; boss: BossKind }
  steps: Step[]
  done: { room: [number, number] | null; hint: string[] }
  ending: string[]
}

export interface Land {
  quest: Quest
  overworld: Pick<GameMap, 'id' | 'name' | 'cols' | 'rows' | 'tiles' | 'rooms' | 'theme' | 'regions' | 'music'>
  caves: CaveSpec[]
  dungeons: DungeonSpec[]
  /** The overworld doorway that leads into each cave and dungeon: [screen x, y, tile x, y]. */
  entrances: Record<string, [number, number, number, number]>
}


// ── Caves ───────────────────────────────────────────────────────────────────
export interface CaveSpec {
  id: string
  name: string
  look: Look
  talk: string[]
  /** A treasure on the floor, taken once. */
  gift?: ItemKind
  shop?: ShopItem[]
}


const CAVE_TILES = [
  '################',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;o;;;;;;o;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#;;;;;;;;;;;;;;#',
  '#######DD#######',
]

/** Where you stand on entering a single-room map (cave or dungeon entrance). */
const roomSpawn = (map: string, rx: number, ry: number): Warp =>
  ({ map, x: (rx * RW + 7) * 16 + 8, y: (ry * RH + 8) * 16, dir: 'up' })


// ── Dungeons ────────────────────────────────────────────────────────────────
export type Layout = keyof typeof LAYOUTS
export type Side = 'n' | 's' | 'e' | 'w'
export type DoorKind = 'open' | 'lock' | 'shut' | 'bomb' | 'thorn' | 'boulder'

// Room interiors (14×9, inside the walls). Door approaches are cleared.
const LAYOUTS = {
  empty: [],
  entry: [
    '..............',
    '..............',
    '..s........s..',
    '..............',
    '..............',
    '..............',
    '..s........s..',
  ],
  pillars: [
    '..............',
    '..s........s..',
    '..............',
    '.....s..s.....',
    '..............',
    '.....s..s.....',
    '..............',
    '..s........s..',
  ],
  blocks: [
    '..............',
    '..............',
    '...ss....ss...',
    '...ss....ss...',
    '..............',
    '...ss....ss...',
    '...ss....ss...',
  ],
  pool: [
    '..............',
    '..............',
    '...WWWWWWWW...',
    '...WWWWWWWW...',
    '...WWWWWWWW...',
    '...WWWWWWWW...',
    '...WWWWWWWW...',
  ],
  lava: [
    '..............',
    '.~~~~....~~~~.',
    '..............',
    '..............',
    '..~~~~..~~~~..',
    '..............',
    '..............',
    '.~~~~....~~~~.',
  ],
  maze: [
    '..............',
    '.ssss....ssss.',
    '....s....s....',
    '....s....s....',
    '..............',
    '....s....s....',
    '....s....s....',
    '.ssss....ssss.',
  ],
  shallows: [
    '..............',
    '..............',
    '..s........s..',
    'wwwwwwwwwwwwww',
    'wwwwwwwwwwwwww',
    '..............',
    '..s........s..',
  ],
  pools: [
    '..............',
    '..............',
    '..WWW....WWW..',
    '..WWW....WWW..',
    '..............',
    '..WWW....WWW..',
    '..WWW....WWW..',
  ],
  arena: [
    '..............',
    '.o..........o.',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.o..........o.',
  ],
  // A chasm across the room with grapple posts on both sides (N and S doors only).
  chasm: [
    '..............',
    '..P........P..',
    '..............',
    'VVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVV',
    '..............',
    '..P........P..',
  ],
  hall: [
    '..............',
    '.o..I....I..o.',
    '....I....I....',
    '..............',
    '..............',
    '..............',
    '....I....I....',
    '.o..I....I..o.',
  ],
  throne: [
    '..............',
    '.o...~~~~...o.',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.o~~......~~o.',
  ],
} satisfies Record<string, string[]>

export interface DungeonRoom extends RoomDef { layout: Layout }

export interface DungeonSpec {
  id: string
  name: string
  music: GameMap['music']
  cols: number
  rows: number
  entry: [number, number]
  rooms: Record<string, DungeonRoom>
  /** [room, side, kind]: a door from that room to its neighbour. */
  doors: [string, Side, DoorKind][]
}


const SIDE_DIR: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' }
const DOOR_CHAR: Record<DoorKind, string> = { open: ':', lock: 'L', shut: 'S', bomb: 'C', thorn: 'X', boulder: 'O' }

/** The wall tiles a door on `side` of room (rx, ry) occupies. */
function doorTiles(rx: number, ry: number, side: Side): [number, number][] {
  const ox = rx * RW
  const oy = ry * RH
  switch (side) {
    case 'n': return [[ox + 7, oy], [ox + 8, oy]]
    case 's': return [[ox + 7, oy + RH - 1], [ox + 8, oy + RH - 1]]
    case 'w': return [[ox, oy + 5]]
    case 'e': return [[ox + RW - 1, oy + 5]]
  }
}

function set(grid: string[][], x: number, y: number, ch: string) { grid[y][x] = ch }

function buildDungeon(spec: DungeonSpec, exit: Warp, quest: QuestId): GameMap {
  const w = spec.cols * RW
  const h = spec.rows * RH
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => '_'))
  const groups: Record<string, string> = {}
  const warps: Record<string, Warp> = {}

  for (const [key, room] of Object.entries(spec.rooms)) {
    const [rx, ry] = key.split(',').map(Number)
    const ox = rx * RW
    const oy = ry * RH
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const edge = x === 0 || y === 0 || x === RW - 1 || y === RH - 1
        set(grid, ox + x, oy + y, edge ? '#' : ':')
      }
    }
    LAYOUTS[room.layout].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') set(grid, ox + 1 + x, oy + 1 + y, row[x])
    })
  }

  const clearApproach = (rx: number, ry: number, side: Side) => {
    const [dx, dy] = SIDE_DIR[side]
    for (const [x, y] of doorTiles(rx, ry, side)) set(grid, x - dx, y - dy, ':')
  }

  for (const [key, side, kind] of spec.doors) {
    const [rx, ry] = key.split(',').map(Number)
    const [dx, dy] = SIDE_DIR[side]
    const other = `${rx + dx},${ry + dy}`
    if (!spec.rooms[other]) throw new Error(`${spec.id}: door from ${key} ${side} leads nowhere`)
    const group = `${key}${side}`
    for (const [x, y] of [...doorTiles(rx, ry, side), ...doorTiles(rx + dx, ry + dy, OPPOSITE[side])]) {
      set(grid, x, y, DOOR_CHAR[kind])
      groups[`${x},${y}`] = group
    }
    clearApproach(rx, ry, side)
    clearApproach(rx + dx, ry + dy, OPPOSITE[side])
  }

  // The way out, at the bottom of the entrance room.
  const [ex, ey] = spec.entry
  for (const [x, y] of doorTiles(ex, ey, 's')) {
    set(grid, x, y, 'D')
    warps[`${x},${y}`] = exit
  }
  clearApproach(ex, ey, 's')

  return {
    id: spec.id, name: spec.name, kind: 'dungeon', cols: spec.cols, rows: spec.rows,
    tiles: grid.map(r => r.join('')), floor: ':', warps, groups,
    rooms: Object.fromEntries(Object.entries(spec.rooms).map(([k, { layout: _, ...room }]) => [k, room])),
    music: spec.music, quest,
  }
}

function buildCave(spec: CaveSpec, exit: Warp, quest: QuestId): GameMap {
  const warps: Record<string, Warp> = { '7,10': exit, '8,10': exit }
  return {
    id: spec.id, name: spec.name, kind: 'cave', cols: 1, rows: 1, tiles: CAVE_TILES, floor: ';',
    warps, groups: {},
    rooms: { '0,0': { npcs: [{ x: 7.5, y: 3, look: spec.look, lines: [] }], talk: spec.talk, item: spec.gift, shop: spec.shop } },
    music: 'cave', quest,
  }
}

function buildLand(land: Land): Record<string, GameMap> {
  const quest = land.quest.id
  const o = land.overworld
  const overworld: GameMap = { ...o, kind: 'overworld', floor: '.', warps: {}, groups: {}, quest }
  const maps: Record<string, GameMap> = { [o.id]: overworld }
  for (const [id, [sx, sy, lx, ly]] of Object.entries(land.entrances)) {
    const tx = sx * RW + lx
    const ty = sy * RH + ly
    const wide = o.tiles[ty][tx + 1] === 'D' // dungeon mouths are two tiles wide
    const exit: Warp = { map: o.id, x: tx * 16 + (wide ? 8 : 0), y: (ty + 1) * 16, dir: 'down' }
    const dungeon = land.dungeons.find(d => d.id === id)
    const cave = land.caves.find(c => c.id === id)
    if (dungeon) maps[id] = buildDungeon(dungeon, exit, quest)
    else if (cave) maps[id] = buildCave(cave, exit, quest)
    else throw new Error(`entrance ${id} leads nowhere`)
    const into = dungeon ? roomSpawn(id, ...dungeon.entry) : roomSpawn(id, 0, 0)
    overworld.warps[`${tx},${ty}`] = into
    if (wide) overworld.warps[`${tx + 1},${ty}`] = into
  }
  return maps
}

const LANDS: Land[] = [EMBERFALL, FROSTREACH]

export const QUESTS = Object.fromEntries(LANDS.map(l => [l.quest.id, l.quest])) as Record<QuestId, Quest>
export const MAPS: Record<string, GameMap> = Object.assign({}, ...LANDS.map(buildLand))

/** Maps with locked doors whose keys only work there. */
export const DUNGEON_IDS = LANDS.flatMap(l => l.dungeons.map(d => d.id))

/** Where a new game begins. */
export const START = EMBERFALL.quest.start

/** Every step's hint, for checking they fit the dialog box. */
export const ALL_HINTS = Object.values(QUESTS).flatMap(q => [...q.steps, q.done].flatMap(s => s.hint))
