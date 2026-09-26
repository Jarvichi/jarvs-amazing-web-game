// ─── /adventure: the Frostreach, the second land ────────────────────────────
//
// Chapter two, across the northern sea: open once the Ashen King is beaten,
// by ship from Emberfall's Dead Shore. A 5×4-screen overworld, three dungeons
// and the Pale Citadel. The iron gloves (Rimeglass Caverns) lift the boulders
// that bar the east; the grapple (Howling Spire) crosses the chasm north of
// the harbour; the mirror shield (Glass Sanctum) throws back the cold light
// that the Glass Eye and the Pale Warden hurl.
//
// New tiles: O boulder (gloves), V chasm, P grapple post, I ice.

import type { CaveSpec, DungeonSpec, Land, RoomDef, Warp } from './maps'
import { RH, RW } from './tiles'

const OVERWORLD_ROWS = [
  // y = 0: Pale Wastes, Frost Ridge, PALE CITADEL, Cold Graves, Starfall
  `
MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM
M..a....a....a.M M..............M MQQQQQQQQQQQQQQM M..g..g..g..g..M M.....MMDMM....M
M.....g....g...M M...R.....R....M MQQQQQQDDQQQQQQM M..............M M.......O......M
M..............M M..............M MQQQQQQKKQQQQQQM M..g..g..g..g..M M..............M
M...a........... ................ .......,,....... ................ ...............M
M,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,.....M
M.......a....... ................ .......,,....... ................ ...............M
M..g.......g...M M...R......R...M M.g....,,....g.M M..g..g..g..g..M M....I....I....M
M.....,,,,.....M M.....,,,,.....M M......,,......M M..............M M...III..III...M
M.....,,,,.....M M.....,,,,.....M M.....,,,,.....M M..............M M....I....I....M
MMMMMM....MMMMMM MMMMMM....MMMMMM MMMMMM....MMMMMM MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM`,
  // y = 1: Sanctum Shore, Frozen Lake, Windswept Heights, Ice Fields, Howling Heights
  `
MMMMMM....MMMMMM MMMMMM....MMMMMM MMMMMM....MMMMMM MMMMMMMMMMMMMMMM MMMMMMMMMMMMMMMM
M.....,,,,.....M M.....,,,,.....M M.....,,,,.....M M..............M M....MMMMMM....M
M..MMMMMMMMMM..M M..IIIIIIIIII..M M..R..,,,,..R..M M..II....II....M M...MMMMMMMM...M
M..MMMMDDMMMM..M M.IIIIIIIIIIII.M M.....,,,,.....M M..II..R.II....M M...MMMDDMMM...M
M......,,....... ..IIIIIIIIIIII.. ......,,,,..R..M M............... .......,,......M
M..W...,,,,,,,,, ,,IIIIIIIIIIII,, ,,,,,,,,,,.....M M,,,,,,,,,,,,,,, ,,,,,,,,,......M
M.WWW........... ..IIIIIIIIIIII.. ..........R....M M......,,....... .......,,......M
M..W......T....M M.IIIIIIIIIIII.M M..R...........M M..R...,,...R..M M......,,......M
M.......T......M M..IIIIIIIIII..M M.......R......M M......,,......M M..R...,,...R..M
M..............M M.....,,,,.....M M..............M M.....,,,,.....M M.....,,,,.....M
MMMMMMMMMMMMMMMM MMMMMM....MMMMMM MMMMMMMMMMMMMMMM MMMMMM....MMMMMM MMMMMM....MMMMMM`,
  // y = 2: Icy Cliffs, The Crossing (a chasm), Rime Hollow, Boulder Pass, Glacier
  `
MMMMMMMMMMMMMMMM MMMMMM....MMMMMM MMMMMMMMMMMMMMMM MMMMMM....MMMMMM MMMMMM....MMMMMM
M..............M M..P........P..M M....MMMMMM....M M.....,,,,.....M MII...,,,,...IIM
M..T....T.....TM M..............M M...MMMMMMMM...M M..R..,,,,..R..M MIII..,,,,..IIIM
M.....II.......M VVVVVVVVVVVVVVVV M...MMMDDMMM...M M.....,,,,.....M MII...,,,,...IIM
M...T.......T..M VVVVVVVVVVVVVVVV M......,,......O ......,,,,...... ......,,,,..IIIM
M..............M VVVVVVVVVVVVVVVV M......,,,,,,,,O ,,,,,,,,,,,,,,,, ,,,,,,,,,,...IIM
M.......T......M M..............M M......,,......O ................ ......,,,,....IM
M..T............ ...P........P... .......,,......M M..O.......O...M M.....,,,,.....M
M.....,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,......M M......R.......M MI....,,,,....IM
M.....,......... ......,,,,...... ......,,,,.....M M..............M MII...,,,,...IIM
MMMMMM....MMMMMM MMMMMM,,,,MMMMMM MMMMMM....MMMMMM MMMMMMMMMMMMMMMM MMMMMM....MMMMMM`,
  // y = 3: Frozen Beach, HARBOUR, Snowfields, Pine Woods, Frozen Falls
  `
TTTTTT....TTTTTT TTTTTT,,,,TTTTTT TTTTTT....TTTTTT TTTTTTTTTTTTTTTT MMMMMM....MMMMMM
T..............T T.hhhh,,,,.hhhhT T....I.....T...T TT..T....T...TTT M....,,,,,..IIIM
TMMDMM....T....T T.HHDH,,,,.HDHHT T..T....IIII...T T....T.......T.T M...,,....,..IIM
T..O.......T...T T...,.,,,,..,..T T.......IIII.T.T T.T.......T....T M..,,..R...,.IIM
T............... ................ ................ ...............O .,,,.......,..IM
W,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,, ,,,,,,,,,,,,,,,O ,,.........,...M
WW.............. .......,,....... ................ .....T.........O .....R.....,...M
WWW.....T......T T......,,......T T..T.....R.....T T.T.....T....T.T M..........,...M
WWWW...........T WWWWWWW==WWWWWWW T.....R......T.T TT...T.....T..TT M...R....,,,...M
WWWWWW.........T WWWWWWW==WWWWWWW TT...........TTT TTT.......T..TTT M........,.....M
WWWWWWWWWWWWWWWW WWWWWWWWWWWWWWWW TTTTTTTTTTTTTTTT TTTTTTTTTTTTTTTT MMMMMMMMMMMMMMMM`,
]

export const FROST_TILES: string[] = OVERWORLD_ROWS.flatMap(block =>
  block.trim().split('\n').map(line => line.replace(/ /g, '')))

/** Stepping off the ship at the harbour. */
export const FROST_START: Warp = { map: 'frost', x: (1 * RW + 7) * 16 + 8, y: (3 * RH + 7) * 16, dir: 'up' }

/** Where the ship leaves you back in Emberfall (the Dead Shore; see emberfall.ts). */
const DEAD_SHORE: Warp = { map: 'overworld', x: 7 * 16 + 8, y: 3 * 16, dir: 'down' }

const OVERWORLD_ROOMS: Record<string, RoomDef> = {
  '1,3': {
    npcs: [
      { x: 7.5, y: 9, look: 'captain', lines: ['BACK TO EMBERFALL? HOLD ON TIGHT!'], ferry: { to: DEAD_SHORE } },
      { x: 3, y: 6, look: 'elder', guide: true, lines: [
        'A HERO FROM THE SOUTH! THEN THE STORIES ARE TRUE: THE ASHEN KING HAS FALLEN.',
        'BUT HE WAS ONLY A SERVANT. HIS MISTRESS, THE PALE WARDEN, HAS HELD THE NORTH IN ICE FOR AN AGE.',
        'THREE BEACONS ONCE WARMED THESE SHORES. LIGHT THEM AGAIN, AND HER CITADEL WILL OPEN.',
      ] },
    ],
  },
  '0,3': { enemies: ['iceblob', 'iceblob', 'wolf'] },
  '2,3': { enemies: ['wolf', 'wolf', 'iceblob'] },
  '3,3': { enemies: ['yeti', 'wolf', 'iceblob'] },
  '0,2': { enemies: ['yeti', 'iceblob', 'bat'] },
  '1,2': { enemies: ['bat', 'bat', 'wolf'] },
  '2,2': { enemies: ['iceblob', 'iceblob', 'wolf'] },
  '4,3': { enemies: ['yeti', 'yeti', 'wolf'] },
  '3,2': { enemies: ['wolf', 'wolf', 'wolf', 'bat'] },
  '4,2': { enemies: ['yeti', 'iceblob', 'iceblob', 'wolf'] },
  '3,1': { enemies: ['yeti', 'wolf', 'wolf', 'bat'] },
  '4,1': { enemies: ['yeti', 'yeti', 'bat', 'bat'] },
  '0,1': { enemies: ['wisp', 'iceblob', 'yeti'] },
  '1,1': { enemies: ['wolf', 'wolf', 'bat', 'bat'] },
  '2,1': { enemies: ['yeti', 'yeti', 'wisp'] },
  '0,0': { enemies: ['knight', 'wisp', 'wisp', 'yeti'] },
  '1,0': { enemies: ['yeti', 'knight', 'wolf', 'wolf'] },
  '2,0': { enemies: ['knight', 'knight', 'wisp', 'yeti'] },
  '3,0': { enemies: ['wisp', 'wisp', 'wisp', 'knight'] },
  '4,0': { enemies: ['yeti', 'yeti', 'wolf', 'bat'] },
}

const CAVES: CaveSpec[] = [
  { id: 'fshop', name: 'HARBOUR STORE', look: 'merchant', talk: [
    'COLD OUT THERE, EH? TOUCH WHAT YOU WANT TO BUY.',
  ], shop: [{ item: 'potion', price: 60 }, { item: 'bombPack', price: 25 }] },
  { id: 'inn', name: 'THE HARBOUR INN', look: 'sage', talk: [
    'THE BOULDERS EAST OF THE WOODS ARE TOO HEAVY FOR BARE HANDS. THE RIMEGLASS CAVERNS HIDE A PAIR OF IRON GLOVES.',
    'STAND FACING A BOULDER AND PRESS A TO LIFT IT. PRESS A AGAIN TO THROW IT.',
  ] },
  { id: 'fheart1', name: 'A HIDDEN HOLLOW', look: 'sage', gift: 'heart', talk: [
    'STRONG HANDS, TO SHIFT THAT STONE. HERE, TAKE THIS.',
  ] },
  { id: 'fheart2', name: 'A HIDDEN HOLLOW', look: 'sage', gift: 'heart', talk: [
    'SO FAR NORTH, AND STILL YOU CLIMB. YOU WILL NEED THIS.',
  ] },
]

const DUNGEONS: DungeonSpec[] = [
  {
    id: 'rimeglass', name: 'THE RIMEGLASS CAVERNS', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['iceblob', 'iceblob'] },
      '1,1': { layout: 'pillars', enemies: ['wolf', 'wolf', 'iceblob'] },
      '0,1': { layout: 'blocks', enemies: ['yeti', 'iceblob', 'iceblob'], key: 'clear' },
      '2,1': { layout: 'entry', enemies: ['wolf', 'wolf', 'wolf'] },
      '2,0': { layout: 'pillars', enemies: ['yeti', 'yeti', 'iceblob'], item: 'gloves' },
      '1,0': { layout: 'maze', enemies: ['wolf', 'iceblob', 'iceblob'] },
      '0,0': { layout: 'arena', boss: 'rimefang' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,1', 'w', 'open'], ['1,1', 'e', 'open'], ['1,1', 'n', 'lock'],
      // The boss is behind a boulder: you need this cavern's gloves to reach it.
      ['2,1', 'n', 'shut'], ['1,0', 'w', 'boulder'],
    ],
  },
  {
    id: 'spire', name: 'THE HOWLING SPIRE', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['bat', 'bat', 'bat', 'wolf'] },
      '0,2': { layout: 'pillars', enemies: ['yeti', 'yeti'], key: 'floor' },
      '2,2': { layout: 'blocks', enemies: ['wolf', 'wolf', 'wolf'], key: 'clear' },
      '2,1': { layout: 'lava', enemies: ['yeti', 'knight', 'bat'], item: 'grapple' },
      '0,1': { layout: 'maze', enemies: ['knight', 'knight'], item: 'heart' },
      // The boss is across a chasm: you need this spire's grapple to reach it.
      '1,1': { layout: 'chasm', enemies: ['bat', 'bat'] },
      '1,0': { layout: 'arena', boss: 'stormcrow' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,2', 'w', 'open'], ['1,2', 'e', 'open'], ['2,2', 'n', 'lock'],
      ['0,2', 'n', 'lock'], ['1,1', 'n', 'shut'],
    ],
  },
  {
    id: 'sanctum', name: 'THE GLASS SANCTUM', music: 'dungeon', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['iceblob', 'iceblob', 'wisp'] },
      '0,2': { layout: 'pools', enemies: ['yeti', 'yeti', 'iceblob'], key: 'clear' },
      '2,2': { layout: 'pillars', enemies: ['wolf', 'wolf', 'knight'] },
      '2,1': { layout: 'blocks', enemies: ['wisp', 'wisp', 'yeti'], item: 'heart' },
      '1,1': { layout: 'pool', enemies: ['knight', 'yeti', 'wisp'] },
      '0,1': { layout: 'pillars', enemies: ['knight', 'knight', 'wisp'], item: 'shield' },
      // The Glass Eye only feels its own light thrown back: you need this sanctum's shield.
      '1,0': { layout: 'arena', boss: 'glasseye' },
    },
    doors: [
      ['1,2', 'n', 'open'], ['1,2', 'w', 'open'], ['1,2', 'e', 'boulder'], ['2,2', 'n', 'open'],
      ['1,1', 'w', 'lock'], ['1,1', 'n', 'shut'],
    ],
  },
  {
    id: 'citadel', name: 'THE PALE CITADEL', music: 'keep', cols: 3, rows: 3, entry: [1, 2],
    rooms: {
      '1,2': { layout: 'entry', enemies: ['knight', 'yeti', 'yeti'] },
      '1,1': { layout: 'pillars', enemies: ['wisp', 'wisp', 'bat', 'bat'] },
      '0,1': { layout: 'pillars', enemies: ['knight', 'knight', 'yeti'], key: 'clear' },
      '2,1': { layout: 'maze', enemies: ['wolf', 'wolf', 'yeti', 'iceblob'], item: 'heart' },
      '1,0': { layout: 'hall', boss: 'warden' },
    },
    doors: [
      ['1,2', 'n', 'shut'], ['1,1', 'w', 'open'], ['1,1', 'e', 'open'], ['1,1', 'n', 'lock'],
    ],
  },
]

const ENTRANCES: Record<string, [number, number, number, number]> = {
  fshop: [1, 3, 4, 2],
  inn: [1, 3, 12, 2],
  fheart1: [0, 3, 3, 2],
  fheart2: [4, 0, 8, 1],
  rimeglass: [2, 2, 7, 3],
  spire: [4, 1, 7, 3],
  sanctum: [0, 1, 7, 3],
  citadel: [2, 0, 7, 2],
}

export const FROSTREACH: Land = {
  quest: {
    id: 'frostreach',
    name: 'THE FROSTREACH',
    overworld: 'frost',
    start: FROST_START,
    flame: 'BEACON',
    dungeons: ['rimeglass', 'spire', 'sanctum'],
    final: { map: 'citadel', boss: 'warden' },
    steps: [
      { id: 'rimeglass', need: { flag: 'got:flame:rimeglass' }, room: [2, 2], hint: [
        'THE FIRST BEACON LIES DEEP IN THE RIMEGLASS CAVERNS, IN THE HOLLOW NORTH-EAST OF THE HARBOUR.',
      ] },
      { id: 'gloves', need: { have: 'gloves' }, room: [2, 2], hint: [
        'THE IRON GLOVES ARE STILL IN THE RIMEGLASS CAVERNS, IN A SEALED ROOM NORTH OF ITS EASTERN HALL.',
      ] },
      { id: 'spire', need: { flag: 'got:flame:spire' }, room: [4, 1], hint: [
        'THE SECOND BEACON BURNS AT THE TOP OF THE HOWLING SPIRE, IN THE FAR NORTH-EAST.',
        'BOULDERS BAR THE WAY EAST OF THE PINE WOODS. FACE ONE AND PRESS A TO LIFT IT WITH THE IRON GLOVES.',
      ] },
      { id: 'grapple', need: { have: 'grapple' }, room: [4, 1], hint: [
        'THE GRAPPLE IS STILL IN THE HOWLING SPIRE, BEHIND A LOCKED DOOR NORTH OF ITS EASTERN HALL.',
      ] },
      { id: 'sanctum', need: { flag: 'got:flame:sanctum' }, room: [0, 1], hint: [
        'THE THIRD BEACON IS HIDDEN IN THE GLASS SANCTUM, FAR TO THE NORTH-WEST.',
        'A CHASM SPLITS THE CROSSING, NORTH OF THE HARBOUR. STAND BELOW A POST AND FIRE THE GRAPPLE AT IT.',
      ] },
      { id: 'shield', need: { have: 'shield' }, room: [0, 1], hint: [
        'THE MIRROR SHIELD IS STILL IN THE GLASS SANCTUM, BEHIND A LOCKED DOOR WEST OF ITS HEART.',
      ] },
      { id: 'citadel', need: { flag: 'boss:citadel' }, room: [2, 0], hint: [
        'THE PALE CITADEL STANDS IN THE FROZEN NORTH. THE WARDEN HURLS COLD LIGHT: STAND STILL, FACE IT, AND YOUR SHIELD WILL THROW IT BACK.',
      ] },
    ],
    done: { room: null, hint: ['THE PALE WARDEN IS GONE, AND THE NORTH IS THAWING. THANK YOU, HERO.'] },
    ending: [
      'THE PALE WARDEN SHATTERS LIKE THIN ICE, AND HER COLD LIGHT GOES OUT.',
      'ACROSS THE FROSTREACH THE THREE BEACONS BLAZE, AND FOR THE FIRST TIME IN AN AGE THE SNOW BEGINS TO MELT.',
      'THE NORTH IS FREE!',
    ],
  },
  overworld: {
    id: 'frost', name: 'THE FROSTREACH', cols: 5, rows: 4, tiles: FROST_TILES, rooms: OVERWORLD_ROOMS,
    theme: 'snow', music: 'frost',
    regions: { pale: ['0,0', '1,0', '2,0', '3,0', '4,0'] },
  },
  caves: CAVES,
  dungeons: DUNGEONS,
  entrances: ENTRANCES,
}
