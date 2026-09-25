// ─── /adventure: the maps of Emberfall ──────────────────────────────────────
//
// The overworld is drawn below as one big grid (6×5 screens, 16×11 tiles
// each), so neighbouring screens always line up. Dungeons are built from a
// room list, a door list and a few interior layouts; caves are single rooms
// built from a template. maps.test.ts walks the whole thing with the item
// gates and proves it can be finished.
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

import { RH, RW } from './tiles'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type EnemyKind = 'blob' | 'beetle' | 'thornling' | 'boar' | 'bat' | 'wisp' | 'knight'
export type BossKind = 'mossback' | 'drake' | 'serpent' | 'king'
export type ItemKind =
  | 'sword' | 'bombs' | 'rod' | 'boots' | 'heart' | 'flame' | 'key' | 'potion' | 'coins' | 'bombPack'
export type Look = 'smith' | 'elder' | 'villager' | 'kid' | 'sage' | 'merchant'

export interface Npc {
  /** Tile position within the room (fractions allowed). */
  x: number
  y: number
  look: Look
  lines: string[]
  /** Points the way to the next goal (after their own lines, the first time). */
  guide?: boolean
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
  music: 'overworld' | 'dungeon' | 'keep' | 'cave'
}

// ── Overworld ───────────────────────────────────────────────────────────────
// One line per tile row; the six screens of a row are separated by spaces.
const OVERWORLD_ROWS = [
  // y = 0: the ashen north — Dead Shore, Grey Dunes, Ash Approach, ASHEN KEEP, Cinder Field, Obsidian Rim
  `
aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaa MMMMMMMMMMMMMMMM aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaa
aWWWWWWWWWWWWWWa a..............a a....g....g....a MQQQQQQQQQQQQQQM a..~~~~....~~~.a a~~~~~~~~~~~~~~a
a..WWWWWWWWWW..a a...a......a...a a..............a MQQQQQQDDQQQQQQM a..~~~~.....~..a a~~..........~~a
a..............a a......R.......a a..~~......~~..a MQQQQQQKKQQQQQQM a..............a a..............a
a...a........... ................ ...~~......~~... .......,,....... .......R........ .....R......R..a
a,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,.....a
a.......a....... .....R......R... ................ .......,,....... ....R.......~~.. ...........R...a
a..a...........a a..............a a..g........g..a a.g....,,....g.a a..........~~~.a a..R...........a
a.....w.....a..a a..a....w...a..a a.....,,,,.....a a......,,......a a..R...........a a.......,,.....a
a....wwww......a a.....wwww.....a a.....,,,,.....a a.....,,,,.....a a.....,,,,.....a a.....,,,,.....a
aaaaaawwwwaaaaaa aaaaaawwwwaaaaaa aaaaaa,,,,aaaaaa aaaaaa,,,,aaaaaa aaaaaa,,,,aaaaaa aaaaaa,,,,aaaaaa`,
  // y = 1: Drowned Marsh, Reed Marsh, Lakeshore, Ash Road, Ash Waste, Burnt Grove
  `
TTTTTTwwwwTTTTTT TTTTTTwwwwTTTTTT aaaaaa....aaaaaa aaaaaa,,,,aaaaaa aaaaaa....aaaaaa aaaaaa....aaaaaa
T.....ww.....W.T T....www.......T a..............a a.....,,,,.....a a....R.......R.a a..............a
T..WW........WWT T..WW......WW..T a....a.....WW..a a..g..,,,,..g..a a..R.....~~....a a..a...a....a..a
T.WWW.RRDRR....T T.WWWW....F....T a.........WWWW.a a.....,,,,.....a a.......~~~~...a a.......RRDRR..a
T......,,,...... ..............ww w.........WWWW.. ......,,,,...... .........~~..... .....a.........a
T..W...,,,,,,,,, ,,,,,,,,,,,,,,ww w,,,,,,,,,,==,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,....a
T.WWW........... .....WW.......ww w.........WWWW.. ..a..........a.. ....R......R.... .......a.......a
T..W.....WW....T T...WWWW.......T a.....ww...WW..a a.......w......a a.......R......a a..a.......a...a
T.......WWWW...T T..........WW..T a.....ww...WW..a a.....www......a a..~~.........Ra a.......a......a
TT....,,,,....TT TT...T.........T a....www...WW..a a.....wwww.....a a..~~~.........a a...a.......a..a
TTTTTT....TTTTTT TTTTTTTTTTTTTTTT aaaaaawwwwaWWaaa aaaaaawwwwaaaaaa MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM`,
  // y = 2: Briar Edge, River Bend, Old Bridge, Ruined Field, Mountain Pass, High Crags
  `
TTTTTT....TTTTTT TTTTTTTTTTTTTTTT TTTTTTwwwwTWWTTT TTTTTTwwwwTTTTTT MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM
T..T..........TT TTT..T....T..TTT T.....ww...WW..T T.....ww.......T MMM...MMMM...MMM MMMMMMMCMMMMMMMM
T.T....T.......T T.....T.......TT T..........WW..T T..RRDRR....g..T M.....R.......MM MM.............M
T....B.....T...T T..B......B....T T..B.......WW..T T....X......g..T M..R.......R...M M...R.....R....M
T............... X............... ...........==... ..R............. ...........MMMMM M.......~~.....M
T,,,,,,,,,,,,,,, X,,,,,,,,,,,,,,, ,,,,,,,,,,,==,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,..MMMM M.R.....~~...R.M
T....T.......... X....T.......... ...........==... .......R........ ........,,...MMM M..............M
T..B.......T...T T.T.......T....T T.....,,...WW..T T.g.......g....T M.......,,....MM M....R.........M
T.T....T.....T.T TT...B.......T.T T.....,,...WW..T T.....,,,,.....T M..R....,,.R..MM M.........R....M
TT...T....T...TT TTT.......T..TTT T.T...,,,,.WW..T T..R..,,,,..R..T M.....,,,,.....M M.....,,,,.....M
TTTTTTTTTTTTTTTT TTTTTT....TTTTTT TTTTTT,,,,TWWTTT TTTTTT....TTTTTT MMMMMM....MMMMMM MMMMMM....MMMMMM`,
  // y = 3: Barrow Glade, Deep Woods, Crossroads, Meadow, Foothills, Cinder Gate
  `
TTTTTTTTTTTTTTTT TTTTTT....TTTTTT TTTTTT,,,,TTTTTT TTTTTT....TTTTTT MMMMMM....MMMMMM MMMMMM....MMMMMM
TTT.....T....TTT T.T..T....T..T.T T.RRDRR,,,.....T T....F.....F...T M....R.........M M~............~M
TT...RRRRRR...TT T....T.B..T....T T...,..,,,.....T T..B.....B.....T M.R.......R....M M...MMMMMMMM...M
T...RRRRRRRR...T TT.T........T.TT T...,,,,,,..F..T T.....FF.......T T.......R....RMM M..MMMMDDMMMM..M
T...RRRDDRRR.... .....T....T..... ........,,...... ...B.........B.. ...............C .......,,......M
T....g.,,..g.... ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,C ,,,,,,,,,......M
T......,,....... ......T...T..... ......,,,,...... .....F....F..... .....R.........C ........,,.....M
T.T....,,...T..T T.T.......B..T.T T..F..,,,,..F..T T.B.........B..T T..........R..MM M..R.....,,....M
TT.B...,,..B..TT T...T.......T..T T.....,,,,.....T T.....,,,,.....T T...R..........M M.......,,..R..M
TTT..,,,,...TTTT TT.T......T..T.T T.T...,,,,...T.T T..F..,,,,..F..T T.....,,,,.....M M.....,,,,.....M
TTTTTT....TTTTTT TTTTTT....TTTTTT TTTTTT,,,,TTTTTT TTTTTT,,,,TTTTTT TTTTTT....MMMMMM MMMMMM....MMMMMM`,
  // y = 4: Old Woods, Woodland Path, EMBERFALL (west), Emberfall (east), Lakeside, Southern Cliffs
  `
TTTTTT....TTTTTT TTTTTT....TTTTTT TTTTTT,,,,TTTTTT TTTTTT,,,,TTTTTT TTTRRR....RRRMMM MMMMMM....MMMMMM
TTTT.......T.TTT TT.T.....B..TTTT T.hhhh,,,,.F...T T.F...,,,,.hhhhT T..............M M..............M
TRRDRT........TT T....T....T...TT T.HDHH,,,,.....T T.....,,,,.HHDHT T...WWWWWW.....M M..MMDMM.......M
TT.X.T..T.....TT T.T......B...T.T T..,..,,,,..F..T T..F..,,,,...,.T T..WWWWWWWW....M M.............RM
T............... ................ .....F..,,..F... .......,,....,.. ...WWWWWWWW....C ........R......M
T.....,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,.WWWWWW.....C ,,,,,,,,,......M
T............... ................ ......,,,,...... ................ .....WWWW......C ...........R...M
T.T..B...T...T.T T.T...T...T..T.T T..F...,,....F.T T..F.......F...T T..............M M....R.........M
TT..T...T..B..TT TT..B....T..B.TT T.B..........B.T T...WWW....F...T T..........MMCMM M.........R....M
TTT..T.....T.TTT TTT.....T.....TT T..BB......BB..T T..WWWWW.......T T.......B......M M...R..........M
TTTTTTTTTTTTTTTT TTTTTTTTTTTTTTTT TTTTTTTTTTTTTTTT TTTTTTTTTTTTTTTT TTTTTTTTTTTTMMMM MMMMMMMMMMMMMMMM`,
]

export const OVERWORLD_TILES: string[] = OVERWORLD_ROWS.flatMap(block =>
  block.trim().split('\n').map(line => line.replace(/ /g, '')))

/** Where a new game begins: Emberfall village, on the path. */
export const START: Warp = { map: 'overworld', x: (2 * RW + 7) * 16 + 8, y: (4 * RH + 5) * 16, dir: 'down' }

const OVERWORLD_ROOMS: Record<string, RoomDef> = {
  // ── the south: home ──
  '2,4': {
    npcs: [{ x: 11, y: 7, look: 'villager', lines: [], guide: true }],
  },
  '3,4': {
    npcs: [
      { x: 4, y: 3, look: 'elder', lines: [
        'THREE HEARTH-FLAMES ONCE BURNED OVER EMBERFALL, AND NO SHADOW COULD CROSS THEM.',
        'THEN THE ASHEN KING CAME DOWN FROM THE NORTH AND SNUFFED THEM OUT, ONE BY ONE.',
        'THEIR EMBERS SLEEP IN THREE DEEP PLACES. RELIGHT THEM, AND HIS GATE WILL OPEN TO YOU.',
      ], guide: true },
      { x: 9, y: 7, look: 'kid', lines: [
        'THE BARROW IN THE WESTERN WOODS GROWLS AT NIGHT. I DARED MY BROTHER TO GO IN.',
        'HE DID NOT.',
      ] },
    ],
  },
  '1,4': { enemies: ['blob', 'blob', 'blob'] },
  '0,4': { enemies: ['blob', 'blob', 'beetle'] },
  '4,4': { enemies: ['beetle', 'beetle', 'blob'] },
  '5,4': { enemies: ['boar', 'boar', 'thornling'] },
  // ── the middle lands ──
  '0,3': { enemies: ['beetle', 'beetle', 'beetle'] },
  '1,3': { enemies: ['thornling', 'blob', 'blob', 'beetle'] },
  '2,3': { enemies: ['blob', 'blob', 'thornling'] },
  '3,3': { enemies: ['beetle', 'beetle', 'thornling'] },
  '4,3': { enemies: ['boar', 'beetle', 'thornling'] },
  '5,3': { enemies: ['bat', 'bat', 'boar', 'boar'] },
  '0,2': { enemies: ['bat', 'thornling', 'thornling', 'beetle'] },
  '1,2': { enemies: ['thornling', 'thornling', 'blob'] },
  '2,2': {
    enemies: ['beetle', 'beetle', 'bat'],
    npcs: [{ x: 3, y: 7, look: 'villager', lines: [
      'THE WATER NORTH OF HERE IS ONLY KNEE DEEP, BUT THE MUD WOULD SWALLOW YOU WHOLE.',
      'THE HERONS WALK IT EASILY. IF ONLY YOU HAD THEIR FEET.',
    ] }],
  },
  '3,2': { enemies: ['boar', 'boar', 'bat', 'bat'] },
  '4,2': { enemies: ['boar', 'boar', 'thornling'] },
  '5,2': { enemies: ['bat', 'bat', 'boar', 'knight'] },
  // ── the marsh ──
  '0,1': { enemies: ['wisp', 'thornling', 'thornling', 'bat'] },
  '1,1': { enemies: ['bat', 'bat', 'bat', 'blob', 'blob'] },
  // ── the ashen north ──
  '2,1': { enemies: ['knight', 'bat', 'bat', 'thornling'] },
  '3,1': { enemies: ['knight', 'knight', 'wisp'] },
  '4,1': { enemies: ['boar', 'boar', 'knight', 'bat'] },
  '5,1': { enemies: ['wisp', 'wisp', 'knight'] },
  '0,0': { enemies: ['knight', 'bat', 'bat', 'wisp'] },
  '1,0': { enemies: ['knight', 'knight', 'boar'] },
  '2,0': { enemies: ['wisp', 'wisp', 'knight', 'thornling'] },
  '3,0': { enemies: ['knight', 'knight', 'wisp'] },
  '4,0': { enemies: ['boar', 'knight', 'knight', 'bat'] },
  '5,0': { enemies: ['wisp', 'wisp', 'wisp', 'bat'] },
}

// ── Where to go next ────────────────────────────────────────────────────────
// Guides in the village, and each flame as it is relit, point to the next
// goal; the minimap blinks on its screen.
export type Goal = 'sword' | 'barrow' | 'bombs' | 'mine' | 'rod' | 'shrine' | 'boots' | 'keep' | 'done'

export const GOALS: Record<Goal, { room: [number, number] | null; hint: string[] }> = {
  sword: { room: [2, 4], hint: [
    'THE OLD SMITH WAS ASKING FOR YOU. HIS FORGE IS THE HOUSE BY THE PATH, ON THE WEST SIDE OF THE VILLAGE.',
  ] },
  barrow: { room: [0, 3], hint: [
    'THE FIRST FLAME SLEEPS IN THE MOSSY BARROW. GO WEST INTO THE WOODS, THEN NORTH TO THE GLADE.',
  ] },
  // A dungeon's treasure left behind (only possible in saves from before its boss needed it).
  bombs: { room: [0, 3], hint: [
    'YOU LEFT SOMETHING IN THE MOSSY BARROW: A BAG OF BOMBS, IN A SEALED ROOM NORTH OF ITS EASTERN HALL. YOU WILL NEED THEM.',
  ] },
  rod: { room: [5, 3], hint: [
    'THE EMBER ROD STILL LIES IN THE CINDER MINE, BEHIND A LOCKED DOOR NORTH OF ITS EASTERN HALL. YOU WILL NEED ITS FIRE.',
  ] },
  boots: { room: [0, 1], hint: [
    'THE HERON BOOTS ARE STILL IN THE DROWNED SHRINE, IN ITS NORTH-WEST ROOM. WITHOUT THEM YOU CANNOT WADE NORTH.',
  ] },
  mine: { room: [5, 3], hint: [
    'THE SECOND FLAME BURNS LOW IN THE CINDER MINE, IN THE EASTERN MOUNTAINS.',
    'CRACKED ROCKS BLOCK THE FOOTHILLS NORTH-EAST OF THE VILLAGE. SET A BOMB BESIDE THEM.',
  ] },
  shrine: { room: [0, 1], hint: [
    'THE THIRD FLAME IS HIDDEN IN THE DROWNED SHRINE, OUT IN THE MARSH.',
    'THORNS CHOKE THE ROAD WEST OF THE RIVER BEND, NORTH-WEST OF THE VILLAGE. BURN THEM WITH THE EMBER ROD.',
  ] },
  keep: { room: [3, 0], hint: [
    'THE ASHEN KEEP STANDS AT THE TOP OF THE WORLD. WADE NORTH ACROSS THE SHALLOWS ABOVE THE OLD BRIDGE.',
  ] },
  done: { room: null, hint: ['THE ASHEN KING IS GONE. REST NOW, HERO OF EMBERFALL.'] },
}

// ── Caves ───────────────────────────────────────────────────────────────────
interface CaveSpec {
  id: string
  name: string
  look: Look
  talk: string[]
  /** A treasure on the floor, taken once. */
  gift?: ItemKind
  shop?: ShopItem[]
}

const CAVES: CaveSpec[] = [
  { id: 'smith', name: 'THE FORGE', look: 'smith', gift: 'sword', talk: [
    'THERE YOU ARE. I HAVE BEEN UP ALL NIGHT AT THE ANVIL.',
    'THE ASHEN KING HAS PUT OUT THE LAST HEARTH-FLAME. WITHOUT THEM THE DARK WILL SPREAD SOUTH.',
    'TAKE THIS BLADE. IT IS THE BEST I HAVE EVER MADE. THE ELDER KNOWS MORE.',
  ] },
  { id: 'shop', name: 'THE STORE', look: 'merchant', talk: [
    'WELCOME! TOUCH WHAT YOU WANT TO BUY.',
  ], shop: [{ item: 'potion', price: 40 }, { item: 'bombPack', price: 20 }, { item: 'heart', price: 150 }] },
  { id: 'hint1', name: 'A COTTAGE', look: 'sage', talk: [
    'THE FIRST FLAME SLEEPS IN THE MOSSY BARROW, IN THE WOODS TO THE WEST.',
    'A SWORD SWUNG AT FULL HEALTH FLIES FURTHER THAN YOU THINK.',
  ] },
  { id: 'hint2', name: 'A HOLLOW', look: 'sage', talk: [
    'THE ASHEN KING WEARS ARMOUR OF COLD ASH. NO BLADE CAN BITE IT.',
    'BURN IT AWAY WITH FIRE, THEN STRIKE BEFORE IT SETTLES AGAIN.',
  ] },
  { id: 'hint3', name: 'A HOLLOW', look: 'sage', talk: [
    'YOU HAVE COME FAR. THE KEEP STANDS TO THE WEST OF HERE.',
    'ITS GATE OPENS ONLY FOR ONE WHO CARRIES ALL THREE HEARTH-FLAMES.',
  ] },
  { id: 'heart1', name: 'A HIDDEN HOLLOW', look: 'sage', gift: 'heart', talk: [
    'FEW THINK TO BREAK THESE ROCKS. TAKE THIS, AND GROW STRONGER.',
  ] },
  { id: 'heart2', name: 'A HIDDEN HOLLOW', look: 'sage', gift: 'heart', talk: [
    'THE THORNS HID ME FOR A HUNDRED YEARS. HERE, THIS IS YOURS NOW.',
  ] },
  { id: 'coins', name: 'A HIDDEN HOLLOW', look: 'merchant', gift: 'coins', talk: [
    'AH, A VISITOR! NOBODY EVER BURNS THEIR WAY IN HERE. HAVE A LITTLE SILVER.',
  ] },
  { id: 'potion', name: 'A HIDDEN HOLLOW', look: 'sage', gift: 'potion', talk: [
    'IF YOU FALL, THIS WILL LIFT YOU BACK UP. ONCE.',
  ] },
]

// A cave room: walls, two braziers, the keeper, the way out at the bottom.
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
type Layout = keyof typeof LAYOUTS
type Side = 'n' | 's' | 'e' | 'w'
type DoorKind = 'open' | 'lock' | 'shut' | 'bomb' | 'thorn'

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

interface DungeonRoom extends RoomDef { layout: Layout }

interface DungeonSpec {
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

const DUNGEONS: DungeonSpec[] = [
  {
    id: 'barrow', name: 'THE MOSSY BARROW', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['blob', 'blob'] },
      '1,1': { layout: 'pillars', enemies: ['blob', 'blob', 'beetle', 'beetle'] },
      '0,1': { layout: 'blocks', enemies: ['beetle', 'beetle', 'beetle'], key: 'clear' },
      '2,1': { layout: 'entry', enemies: ['bat', 'bat', 'blob'] },
      '2,0': { layout: 'pillars', enemies: ['beetle', 'beetle', 'thornling', 'thornling'], item: 'bombs' },
      '1,0': { layout: 'maze', enemies: ['thornling', 'thornling', 'blob', 'blob'] },
      '0,0': { layout: 'arena', boss: 'mossback' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,1', 'w', 'open'], ['1,1', 'e', 'open'], ['1,1', 'n', 'lock'],
      // The boss is behind a cracked wall: you need this barrow's bombs to reach it.
      ['2,1', 'n', 'shut'], ['1,0', 'w', 'bomb'],
    ],
  },
  {
    id: 'mine', name: 'THE CINDER MINE', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'lava', enemies: ['bat', 'bat', 'bat'] },
      '0,2': { layout: 'pillars', enemies: ['beetle', 'beetle', 'beetle'], key: 'floor' },
      '2,2': { layout: 'blocks', enemies: ['boar', 'boar', 'thornling'], key: 'clear' },
      '2,1': { layout: 'lava', enemies: ['knight', 'knight', 'bat'], item: 'rod' },
      '1,1': { layout: 'maze', enemies: ['thornling', 'thornling', 'thornling', 'beetle'] },
      '0,1': { layout: 'blocks', enemies: ['boar', 'boar', 'boar'], item: 'heart' },
      '1,0': { layout: 'lava', boss: 'drake' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,2', 'e', 'open'], ['1,2', 'w', 'bomb'], ['2,2', 'n', 'lock'],
      // The boss is behind thorns: you need this mine's ember rod to reach it.
      ['2,1', 'w', 'shut'], ['1,1', 'w', 'lock'], ['1,1', 'n', 'thorn'],
    ],
  },
  {
    id: 'shrine', name: 'THE DROWNED SHRINE', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'pool', enemies: ['blob', 'blob', 'bat'] },
      '0,2': { layout: 'pools', enemies: ['thornling', 'thornling', 'thornling'], key: 'clear' },
      '0,1': { layout: 'pillars', enemies: ['bat', 'bat', 'bat', 'wisp'] },
      '0,0': { layout: 'pillars', enemies: ['knight', 'knight'], item: 'boots' },
      '1,1': { layout: 'blocks', enemies: ['knight', 'boar', 'boar'] },
      '2,2': { layout: 'maze', enemies: ['beetle', 'beetle', 'beetle', 'beetle'], key: 'floor' },
      '2,1': { layout: 'shallows', enemies: ['wisp', 'wisp'] },
      '2,0': { layout: 'pillars', enemies: ['knight', 'knight', 'thornling'] },
      '1,0': { layout: 'pools', boss: 'serpent' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,2', 'w', 'open'], ['1,2', 'e', 'open'], ['0,2', 'n', 'open'],
      ['0,1', 'e', 'open'], ['0,1', 'n', 'lock'], ['2,2', 'n', 'lock'], ['2,1', 'n', 'open'],
      ['2,0', 'w', 'shut'],
    ],
  },
  {
    id: 'keep', name: 'THE ASHEN KEEP', music: 'keep', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['knight', 'knight', 'wisp'] },
      '1,1': { layout: 'lava', enemies: ['wisp', 'wisp', 'bat', 'bat', 'knight'] },
      '0,1': { layout: 'pillars', enemies: ['knight', 'knight', 'knight'], key: 'clear' },
      '2,1': { layout: 'maze', enemies: ['boar', 'boar', 'thornling', 'thornling'], item: 'heart' },
      '1,0': { layout: 'throne', boss: 'king' },
    },
    doors: [
      ['1,2', 'n', 'shut'], ['1,1', 'w', 'open'], ['1,1', 'e', 'open'], ['1,1', 'n', 'lock'],
    ],
  },
]

/** The overworld doorway that leads into each cave and dungeon: [screen x, y, tile x, y]. */
const ENTRANCES: Record<string, [number, number, number, number]> = {
  smith: [2, 4, 3, 2],
  shop: [3, 4, 13, 2],
  coins: [0, 4, 3, 2],
  heart1: [4, 4, 13, 8],
  hint2: [5, 4, 5, 2],
  barrow: [0, 3, 7, 4],
  hint1: [2, 3, 4, 1],
  mine: [5, 3, 7, 3],
  heart2: [3, 2, 5, 2],
  potion: [5, 2, 7, 1],
  shrine: [0, 1, 8, 3],
  hint3: [5, 1, 10, 3],
  keep: [3, 0, 7, 2],
}

const SIDE_DIR: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' }
const DOOR_CHAR: Record<DoorKind, string> = { open: ':', lock: 'L', shut: 'S', bomb: 'C', thorn: 'X' }

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

function buildDungeon(spec: DungeonSpec, exit: Warp): GameMap {
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
    music: spec.music,
  }
}

function buildCave(spec: CaveSpec, exit: Warp): GameMap {
  const warps: Record<string, Warp> = { '7,10': exit, '8,10': exit }
  return {
    id: spec.id, name: spec.name, kind: 'cave', cols: 1, rows: 1, tiles: CAVE_TILES, floor: ';',
    warps, groups: {},
    rooms: { '0,0': { npcs: [{ x: 7.5, y: 3, look: spec.look, lines: [] }], talk: spec.talk, item: spec.gift, shop: spec.shop } },
    music: 'cave',
  }
}

function buildWorld(): Record<string, GameMap> {
  const overworld: GameMap = {
    id: 'overworld', name: 'EMBERFALL', kind: 'overworld', cols: 6, rows: 5, tiles: OVERWORLD_TILES,
    floor: '.', warps: {}, groups: {}, rooms: OVERWORLD_ROOMS, music: 'overworld',
  }
  const maps: Record<string, GameMap> = { overworld }

  for (const [id, [sx, sy, lx, ly]] of Object.entries(ENTRANCES)) {
    const tx = sx * RW + lx
    const ty = sy * RH + ly
    const wide = OVERWORLD_TILES[ty][tx + 1] === 'D' // dungeon mouths are two tiles wide
    const exit: Warp = { map: 'overworld', x: tx * 16 + (wide ? 8 : 0), y: (ty + 1) * 16, dir: 'down' }
    const dungeon = DUNGEONS.find(d => d.id === id)
    const cave = CAVES.find(c => c.id === id)
    if (dungeon) maps[id] = buildDungeon(dungeon, exit)
    else if (cave) maps[id] = buildCave(cave, exit)
    else throw new Error(`entrance ${id} leads nowhere`)
    const into = dungeon ? roomSpawn(id, ...dungeon.entry) : roomSpawn(id, 0, 0)
    overworld.warps[`${tx},${ty}`] = into
    if (wide) overworld.warps[`${tx + 1},${ty}`] = into
  }
  return maps
}

export const MAPS = buildWorld()

/** Which dungeon's keys a map uses (keys only open doors in their own dungeon). */
export const DUNGEON_IDS = DUNGEONS.map(d => d.id)
