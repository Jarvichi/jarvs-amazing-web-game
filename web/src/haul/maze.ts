// ─── /haul: the streets ─────────────────────────────────────────────────────
//
// Each maze is a grid of 8-pixel tiles written as strings:
//
//   #  fence (the edge of the street)      H  house
//   .  pavement                             D  doorstep of a lit house
//   L  jack-o'-lantern                      B  your own doorstep (bank here)
//   G  the graveyard where ghouls rise      -  graveyard gate
//
// A pavement cell on the left or right edge wraps round to the other side.
// Pure data and grid helpers; maze.test (in logic.test.ts) checks every
// layout is fully connected with no dead ends.

export const TILE = 8

export type Dir = 'up' | 'down' | 'left' | 'right'
export const DIRS: Dir[] = ['up', 'left', 'down', 'right']
export const DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 }
export const DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 }
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export interface Cell { x: number; y: number }

export interface Maze {
  cols: number
  rows: number
  rows_: string[]
  home: Cell
  /** Where ghouls step out of the graveyard. */
  gate: Cell
  pen: Cell[]
  doors: Cell[]
  lanterns: Cell[]
}

// Three layouts; the five streets reuse them with different themes.
export const LAYOUTS: string[][] = [
  // Pumpkin Lane
  [
    '###################',
    '#.D..D...#...D..D.#',
    '#.HH.HHH.#.HHH.HH.#',
    '#L.D....D.D....D.L#',
    '#.HH.H.HHHHH.H.HH.#',
    '#...DH...H...HD...#',
    '####.HHH.H.HHH.####',
    '####.H.......H.####',
    '####.H.HH-HH.H.####',
    '.......HGGGH.......',
    '####.H.HHHHH.H.####',
    '####.H.......H.####',
    '####.H.HHHHH.H.####',
    '#.D.....DHD.....D.#',
    '#.HH.HHH.H.HHH.HH.#',
    '#L.H.....B.....H.L#',
    '##.H.H.HHHHH.H.H.##',
    '#...DH...H...HD...#',
    '#.HHHHHH.H.HHHHHH.#',
    '#...D.........D...#',
    '###################',
  ],
  // Graveyard Row
  [
    '###################',
    '#L..D....#....D..L#',
    '#.HHH.HH.#.HH.HHH.#',
    '#.HHH.HH...HH.HHH.#',
    '#..D...D.H.D...D..#',
    '#.HH.H.HHHHH.H.HH.#',
    '#.HH.H...H...H.HH.#',
    '#....HHH.H.HHH....#',
    '###.H.........H.###',
    '....H.HH-HH.H.H....',
    '###.D.HGGGH.D...###',
    '###.H.HHHHH.H.H.###',
    '#.D.H.......H.D...#',
    '#.HHH.HHHHH.HHH.H.#',
    '#.....D.B.D.....H.#',
    '#.HH.HHHHHHHHH.HH.#',
    '#L.H.D...H...D.H.L#',
    '##.H.H.H.H.H.H.H.##',
    '#....H.H...H.H....#',
    '#...HH.D.H.D.HH...#',
    '###################',
  ],
  // Witchwood
  [
    '###################',
    '#.....D.....D.....#',
    '#.HHH.HH.H.HH.HHH.#',
    '#L.D.....H.....D.L#',
    '#.HH.H.HHHHH.H.HH.#',
    '#....H...D...H....#',
    '#.HH.HHH.H.HHH.HH.#',
    '#.D.............D.#',
    '#.HH.H.HH-HH.H.HH.#',
    '.......HGGGH.......',
    '#.HH.H.HHHHH.H.HH.#',
    '#..D.H...B...H.D..#',
    '#.HH.H.HHHHH.H.HH.#',
    '#....D...H...D....#',
    '##.HHHHH.H.HHHHH.##',
    '#L...............L#',
    '#.HHH.HH.H.HH.HHH.#',
    '#..D...D.H.D...D..#',
    '#.HH.HHH.H.HHH.HH.#',
    '#.................#',
    '###################',
  ],
]

export function parseMaze(rows: string[]): Maze {
  const find = (ch: string): Cell[] => {
    const out: Cell[] = []
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === ch) out.push({ x, y }) })
    return out
  }
  const home = find('B')[0]
  const gateCell = find('-')[0]
  return {
    cols: rows[0].length,
    rows: rows.length,
    rows_: rows,
    home,
    gate: { x: gateCell.x, y: gateCell.y - 1 },
    pen: find('G'),
    doors: find('D'),
    lanterns: find('L'),
  }
}

export const tileAt = (m: Maze, x: number, y: number): string => {
  if (y < 0 || y >= m.rows) return '#'
  const wx = ((x % m.cols) + m.cols) % m.cols
  return m.rows_[y][wx]
}

/** Pavement, doorsteps and lanterns: anywhere a walker can stand. */
export const walkable = (m: Maze, x: number, y: number): boolean => '.DLB'.includes(tileAt(m, x, y))

export const isHouse = (m: Maze, x: number, y: number): boolean => tileAt(m, x, y) === 'H'

/** The house a doorstep belongs to: the first house next to it. */
export function houseFor(m: Maze, c: Cell): Cell | null {
  for (const d of DIRS) {
    if (isHouse(m, c.x + DX[d], c.y + DY[d])) return { x: c.x + DX[d], y: c.y + DY[d] }
  }
  return null
}

/** Open directions out of a cell. */
export const exits = (m: Maze, x: number, y: number): Dir[] => DIRS.filter(d => walkable(m, x + DX[d], y + DY[d]))

export const MAZES: Maze[] = LAYOUTS.map(parseMaze)
