// ─── /adventure: Emberfall, the first land ──────────────────────────────────
//
// Chapter one: the vale of Emberfall, its three dungeons and the Ashen Keep.
// The overworld is drawn below as one big grid (6×5 screens, 16×11 tiles
// each), so neighbouring screens always line up. See maps.ts for the tile
// legend and how the pieces are built.

import type { CaveSpec, DungeonSpec, Land, RoomDef, Warp } from './maps'
import { RH, RW } from './tiles'

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


export const EMBERFALL: Land = {
  quest: {
    id: 'emberfall',
    name: 'EMBERFALL',
    overworld: 'overworld',
    start: START,
    flame: 'HEARTH-FLAME',
    dungeons: ['barrow', 'mine', 'shrine'],
    final: { map: 'keep', boss: 'king' },
    // Guides in the village, and each flame as it is relit, point to the first
    // step not yet done; the minimap blinks on its screen. A dungeon's treasure
    // gets its own step in case an old save left it behind.
    steps: [
      { id: 'sword', need: { have: 'sword' }, room: [2, 4], hint: [
        'THE OLD SMITH WAS ASKING FOR YOU. HIS FORGE IS THE HOUSE BY THE PATH, ON THE WEST SIDE OF THE VILLAGE.',
      ] },
      { id: 'barrow', need: { flag: 'got:flame:barrow' }, room: [0, 3], hint: [
        'THE FIRST FLAME SLEEPS IN THE MOSSY BARROW. GO WEST INTO THE WOODS, THEN NORTH TO THE GLADE.',
      ] },
      { id: 'bombs', need: { have: 'hasBombs' }, room: [0, 3], hint: [
        'YOU LEFT SOMETHING IN THE MOSSY BARROW: A BAG OF BOMBS, IN A SEALED ROOM NORTH OF ITS EASTERN HALL. YOU WILL NEED THEM.',
      ] },
      { id: 'mine', need: { flag: 'got:flame:mine' }, room: [5, 3], hint: [
        'THE SECOND FLAME BURNS LOW IN THE CINDER MINE, IN THE EASTERN MOUNTAINS.',
        'CRACKED ROCKS BLOCK THE FOOTHILLS NORTH-EAST OF THE VILLAGE. SET A BOMB BESIDE THEM.',
      ] },
      { id: 'rod', need: { have: 'rod' }, room: [5, 3], hint: [
        'THE EMBER ROD STILL LIES IN THE CINDER MINE, BEHIND A LOCKED DOOR NORTH OF ITS EASTERN HALL. YOU WILL NEED ITS FIRE.',
      ] },
      { id: 'shrine', need: { flag: 'got:flame:shrine' }, room: [0, 1], hint: [
        'THE THIRD FLAME IS HIDDEN IN THE DROWNED SHRINE, OUT IN THE MARSH.',
        'THORNS CHOKE THE ROAD WEST OF THE RIVER BEND, NORTH-WEST OF THE VILLAGE. BURN THEM WITH THE EMBER ROD.',
      ] },
      { id: 'boots', need: { have: 'boots' }, room: [0, 1], hint: [
        'THE HERON BOOTS ARE STILL IN THE DROWNED SHRINE, IN ITS NORTH-WEST ROOM. WITHOUT THEM YOU CANNOT WADE NORTH.',
      ] },
      { id: 'keep', need: { flag: 'boss:keep' }, room: [3, 0], hint: [
        'THE ASHEN KEEP STANDS AT THE TOP OF THE WORLD. WADE NORTH ACROSS THE SHALLOWS ABOVE THE OLD BRIDGE.',
      ] },
    ],
    done: { room: null, hint: ['THE ASHEN KING IS GONE. REST NOW, HERO OF EMBERFALL.'] },
    ending: [
      'THE ASHEN KING CRUMBLES INTO COLD GREY DUST, AND THE WIND CARRIES HIM AWAY.',
      'FAR TO THE SOUTH, THE THREE HEARTH-FLAMES LEAP UP BRIGHTER THAN EVER BEFORE.',
      'EMBERFALL IS SAVED!',
    ],
  },
  overworld: {
    id: 'overworld', name: 'EMBERFALL', cols: 6, rows: 5, tiles: OVERWORLD_TILES, rooms: OVERWORLD_ROOMS,
    theme: 'green',
    regions: {
      ash: ['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '2,1', '3,1', '4,1', '5,1'],
      marsh: ['0,1', '1,1', '0,2'],
    },
  },
  caves: CAVES,
  dungeons: DUNGEONS,
  entrances: ENTRANCES,
}
