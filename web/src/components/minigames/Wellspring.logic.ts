// ─── Wellspring — puzzle logic ────────────────────────────────────────────────
//
// A conduit-routing puzzle: rotate the aqueduct pieces until water runs from
// the spring through every section with nothing spilling. Pure and
// React-free — the screen, the board component and the tests all read from
// here. See docs/minigame-wellspring.md for the design.
//
// The board is generated *from* its solution (a spanning tree laid over the
// grid, then scrambled), so it can never be unsolvable. The solved check is
// still a flood-fill rather than a comparison against that stored solution:
// where a board admits a second valid arrangement the player gets credit for
// it, which is what makes finishing under par possible at all.

import DEPTH_DATA from '../../data/wellspringDepths.json'

// ── Directions & masks ────────────────────────────────────────────────────────

/** Direction indices. A piece's open sides are a 4-bit mask over these. */
export const NORTH = 0
export const EAST  = 1
export const SOUTH = 2
export const WEST  = 3

/** Bit for each direction index: N=1, E=2, S=4, W=8. */
export const DIR_BIT = [1, 2, 4, 8] as const

const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

/** The direction facing back the other way. */
export function opposite(dir: number): number {
  return (dir + 2) % 4
}

/** Rotate a mask clockwise by `steps` quarter-turns. */
export function rotate(mask: number, steps: number): number {
  const s = ((steps % 4) + 4) % 4
  if (s === 0) return mask
  let out = 0
  for (let d = 0; d < 4; d++) {
    if (mask & DIR_BIT[d]) out |= DIR_BIT[(d + s) % 4]
  }
  return out
}

/**
 * How many quarter-turns before a piece repeats itself: 1 for a cross (and an
 * empty mask), 2 for a straight, 4 for everything else.
 *
 * This is the whole trick behind an honest par. A straight pipe is at most one
 * tap from correct, never three, and a cross is always zero — treating every
 * piece as a flat 4 inflates par by roughly 40% and leaves the under-par bonus
 * unreachable.
 */
export function rotationPeriod(mask: number): number {
  for (let p = 1; p < 4; p++) {
    if (rotate(mask, p) === mask) return p
  }
  return 4
}

/** Minimum clockwise taps to turn `from` into `to`, or 0 if unreachable. */
export function stepsBetween(from: number, to: number): number {
  for (let r = 0; r < 4; r++) {
    if (rotate(from, r) === to) return r
  }
  return 0
}

/** The piece shape a mask describes — presentation reads this to pick a sprite. */
export type PieceKind = 'blank' | 'cap' | 'elbow' | 'straight' | 'tee' | 'cross'

export function pieceKind(mask: number): PieceKind {
  switch (countBits(mask)) {
    case 0:  return 'blank'
    case 1:  return 'cap'
    case 2:  return rotationPeriod(mask) === 2 ? 'straight' : 'elbow'
    case 3:  return 'tee'
    default: return 'cross'
  }
}

function countBits(mask: number): number {
  let n = 0
  for (let d = 0; d < 4; d++) if (mask & DIR_BIT[d]) n++
  return n
}

// ── Board model ───────────────────────────────────────────────────────────────

export type CellRole = 'pipe' | 'source' | 'basin'

export interface Cell {
  /** Current orientation — what the player sees. */
  mask:     number
  /** The generated correct orientation. Never shown; only par and dowse read it. */
  solution: number
  /** Source and welded cells: pre-solved and never rotatable. */
  fixed:    boolean
  /** Rusted in place — costs 2 taps per quarter-turn instead of 1. */
  seized:   boolean
  role:     CellRole
}

export interface Board {
  w:            number
  h:            number
  /** Torus mode: the grid wraps, so the border stops being a solving anchor. */
  wrap:         boolean
  cells:        Cell[]
  sourceIndex:  number
  basinIndexes: number[]
  /** Minimum taps to undo the scramble, counting seized cells double. */
  par:          number
}

export type Rng = () => number

/**
 * Neighbouring cell index in a direction, or -1 if there is none. The single
 * wrap-aware adjacency function — the generator, the flood-fill and the
 * renderer all go through it so torus mode cannot drift between them.
 */
export function neighbourIndex(board: Pick<Board, 'w' | 'h' | 'wrap'>, index: number, dir: number): number {
  const { w, h, wrap } = board
  const x = index % w
  const y = Math.floor(index / w)
  let nx = x + DX[dir]
  let ny = y + DY[dir]
  if (wrap) {
    nx = (nx + w) % w
    ny = (ny + h) % h
  } else if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
    return -1
  }
  const next = ny * w + nx
  // A 1-wide or 1-tall wrapped grid would make a cell its own neighbour.
  return next === index ? -1 : next
}

// ── Depth configuration ───────────────────────────────────────────────────────

/** How the spanning tree is laid out, which is what sets the piece mix:
 *  'path' caps every cell at two connections (caps, elbows and straights
 *  only), 'sparse' at three (adds tees), 'dense' is uncapped (adds crosses). */
export type TreeStyle = 'path' | 'sparse' | 'dense'

export interface DepthConfig {
  id:          string
  label:       string
  subtitle:    string
  w:           number
  h:           number
  wrap:        boolean
  treeStyle:   TreeStyle
  basins:      number
  welded:      number
  seized:      number
  ticketBase:  number
  crystalBase: number
  cleanWater:  number
}

export const WELLSPRING_DEPTHS = DEPTH_DATA.depths as DepthConfig[]

export const WELLSPRING_SCORING = DEPTH_DATA.scoring as {
  efficiencyFloor: number
  underParBonus:   number
  dowseMoveCost:   number
}

export type DepthId = string

export function getDepth(id: DepthId): DepthConfig {
  return WELLSPRING_DEPTHS.find(d => d.id === id) ?? WELLSPRING_DEPTHS[0]
}

// ── Spanning-tree generation ──────────────────────────────────────────────────

interface Edge { a: number; b: number; dir: number }

function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Dims = Pick<Board, 'w' | 'h' | 'wrap'>

/**
 * A random Hamiltonian path via backbite: start from a boustrophedon snake and
 * repeatedly re-hang one end onto a random neighbour. Every step yields
 * another Hamiltonian path, so unlike a self-avoiding random walk this always
 * terminates with a valid result — no retry loop, no dead ends.
 */
function hamiltonianPath(dims: Dims, rng: Rng): number[] {
  const { w, h } = dims
  const n = w * h
  let path: number[] = []
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      const x = y % 2 === 0 ? i : w - 1 - i
      path.push(y * w + x)
    }
  }

  const steps = n * n * 2
  for (let s = 0; s < steps; s++) {
    // Backbite the tail; flipping the path first gives the head its turn.
    if (rng() < 0.5) path = path.slice().reverse()
    const tail = path[n - 1]
    const dir = Math.floor(rng() * 4)
    const v = neighbourIndex(dims, tail, dir)
    if (v < 0) continue
    const i = path.indexOf(v)
    if (i < 0 || i >= n - 2) continue  // already the last edge, or the tail itself
    const head = path.slice(0, i + 1)
    const flipped = path.slice(i + 1).reverse()
    path = head.concat(flipped)
  }
  return path
}

function pathEdges(dims: Dims, path: number[]): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]
    const b = path[i + 1]
    const dir = dirBetween(dims, a, b)
    if (dir >= 0) edges.push({ a, b, dir })
  }
  return edges
}

function dirBetween(dims: Dims, a: number, b: number): number {
  for (let d = 0; d < 4; d++) {
    if (neighbourIndex(dims, a, d) === b) return d
  }
  return -1
}

/** Randomised depth-first spanning tree, refusing to push any cell past
 *  `maxDegree`. Returns null when the cap strands a cell — the caller retries. */
function dfsTree(dims: Dims, start: number, maxDegree: number, rng: Rng): Edge[] | null {
  const n = dims.w * dims.h
  const visited = new Array<boolean>(n).fill(false)
  const degree  = new Array<number>(n).fill(0)
  const edges: Edge[] = []
  const stack = [start]
  visited[start] = true
  let seen = 1

  while (stack.length > 0) {
    const c = stack[stack.length - 1]
    if (degree[c] >= maxDegree) { stack.pop(); continue }
    let moved = false
    for (const d of shuffled([0, 1, 2, 3], rng)) {
      const nb = neighbourIndex(dims, c, d)
      if (nb < 0 || visited[nb]) continue
      visited[nb] = true
      degree[c]++
      degree[nb]++
      edges.push({ a: c, b: nb, dir: d })
      stack.push(nb)
      seen++
      moved = true
      break
    }
    if (!moved) stack.pop()
  }
  return seen === n ? edges : null
}

/** Randomised Prim spanning tree. Branches far more freely than DFS, which is
 *  what puts genuine crosses and tees on the board. Always spans. */
function primTree(dims: Dims, start: number, rng: Rng): Edge[] {
  const n = dims.w * dims.h
  const visited = new Array<boolean>(n).fill(false)
  const edges: Edge[] = []
  const frontier: Edge[] = []
  visited[start] = true

  function pushFrontier(c: number) {
    for (let d = 0; d < 4; d++) {
      const nb = neighbourIndex(dims, c, d)
      if (nb >= 0 && !visited[nb]) frontier.push({ a: c, b: nb, dir: d })
    }
  }
  pushFrontier(start)

  while (frontier.length > 0) {
    const pick = Math.floor(rng() * frontier.length)
    const edge = frontier[pick]
    frontier[pick] = frontier[frontier.length - 1]
    frontier.pop()
    if (visited[edge.b]) continue
    visited[edge.b] = true
    edges.push(edge)
    pushFrontier(edge.b)
  }
  return edges
}

const DFS_ATTEMPTS = 60

function buildTree(dims: Dims, style: TreeStyle, start: number, rng: Rng): Edge[] {
  if (style === 'path') return pathEdges(dims, hamiltonianPath(dims, rng))
  if (style === 'dense') return primTree(dims, start, rng)
  for (let attempt = 0; attempt < DFS_ATTEMPTS; attempt++) {
    const edges = dfsTree(dims, start, 3, rng)
    if (edges) return edges
  }
  // A degree cap can strand a cell. Uncapped DFS always spans, so the board
  // stays valid — it may just carry a cross it would not normally have.
  return dfsTree(dims, start, 4, rng)!
}

function borderCells(dims: Dims): number[] {
  const { w, h } = dims
  const out: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) out.push(y * w + x)
    }
  }
  return out
}

// ── Board generation ──────────────────────────────────────────────────────────

const GENERATE_ATTEMPTS = 20

/**
 * Build a scrambled board for a depth. Solvable by construction: the tree is
 * laid first and the pieces are read off it, so the unscrambled board is
 * already a solution.
 */
export function generateBoard(depth: DepthConfig, rng: Rng = Math.random): Board {
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt++) {
    const board = buildBoard(depth, rng)
    // A scramble that happens to leave every piece already correct would hand
    // the player a solved board. Vanishingly rare, but cheap to reject.
    if (board.par > 0) return board
  }
  return buildBoard(depth, rng)
}

function buildBoard(depth: DepthConfig, rng: Rng): Board {
  const dims: Dims = { w: depth.w, h: depth.h, wrap: depth.wrap }
  const n = depth.w * depth.h

  // Root the tree on a border cell when there is a border to root it on, so
  // the spring reads as feeding in from outside the frame.
  const roots = depth.wrap ? Array.from({ length: n }, (_, i) => i) : borderCells(dims)
  const start = roots[Math.floor(rng() * roots.length)]

  const edges = buildTree(dims, depth.treeStyle, start, rng)

  const solution = new Array<number>(n).fill(0)
  const degree   = new Array<number>(n).fill(0)
  const adjacency: number[][] = Array.from({ length: n }, () => [])
  for (const e of edges) {
    solution[e.a] |= DIR_BIT[e.dir]
    solution[e.b] |= DIR_BIT[opposite(e.dir)]
    degree[e.a]++
    degree[e.b]++
    adjacency[e.a].push(e.b)
    adjacency[e.b].push(e.a)
  }

  // A path's root has to be one of its two endpoints, not the DFS/Prim start.
  const sourceIndex = depth.treeStyle === 'path'
    ? pickPathEnd(dims, degree, depth.wrap, rng)
    : start

  const basinIndexes = pickBasins(adjacency, degree, sourceIndex, depth.basins)

  const cells: Cell[] = solution.map((mask, i) => ({
    mask,
    solution: mask,
    fixed:    i === sourceIndex,
    seized:   false,
    role:     i === sourceIndex ? 'source' : basinIndexes.includes(i) ? 'basin' : 'pipe',
  }))

  // Welded and seized only mean anything on a piece that can actually turn.
  const turnable = cells
    .map((c, i) => i)
    .filter(i => !cells[i].fixed && rotationPeriod(cells[i].solution) > 1)
  const marked = shuffled(turnable, rng)
  for (const i of marked.slice(0, depth.welded)) cells[i].fixed = true
  for (const i of marked.slice(depth.welded, depth.welded + depth.seized)) cells[i].seized = true

  let par = 0
  for (const cell of cells) {
    if (cell.fixed) continue
    const period = rotationPeriod(cell.solution)
    if (period === 1) continue
    const turns = Math.floor(rng() * period)
    cell.mask = rotate(cell.solution, turns)
    par += stepsBetween(cell.mask, cell.solution) * (cell.seized ? 2 : 1)
  }

  return { w: depth.w, h: depth.h, wrap: depth.wrap, cells, sourceIndex, basinIndexes, par }
}

function pickPathEnd(dims: Dims, degree: number[], wrap: boolean, rng: Rng): number {
  const ends = degree.map((d, i) => (d === 1 ? i : -1)).filter(i => i >= 0)
  if (ends.length === 0) return 0
  if (!wrap) {
    const border = new Set(borderCells(dims))
    const onBorder = ends.filter(i => border.has(i))
    if (onBorder.length > 0) return onBorder[Math.floor(rng() * onBorder.length)]
  }
  return ends[Math.floor(rng() * ends.length)]
}

/** The deepest dead ends, by tree distance from the source — so the basins sit
 *  at the far ends of the network rather than next door to the spring. */
function pickBasins(adjacency: number[][], degree: number[], source: number, want: number): number[] {
  const dist = new Array<number>(adjacency.length).fill(-1)
  dist[source] = 0
  const queue = [source]
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]
    for (const nb of adjacency[c]) {
      if (dist[nb] === -1) { dist[nb] = dist[c] + 1; queue.push(nb) }
    }
  }
  return degree
    .map((d, i) => ({ i, d }))
    .filter(({ i, d }) => d === 1 && i !== source)
    .sort((a, b) => dist[b.i] - dist[a.i])
    .slice(0, want)
    .map(({ i }) => i)
}

// ── Flow ──────────────────────────────────────────────────────────────────────

export interface LeakEnd { index: number; dir: number }

export interface Flow {
  /** Cells the water reaches from the source. */
  filled:    boolean[]
  /** Open ends carrying water that face a wall or a piece that doesn't open back. */
  leaks:     LeakEnd[]
  basinsFed: number
  solved:    boolean
}

/**
 * Flood-fill from the source across mutual connections, then collect every
 * spilling end. Solved when the water reaches every cell and nothing leaks —
 * which is also the whole rule, as the player is told it.
 */
export function computeFlow(board: Board): Flow {
  const n = board.cells.length
  const filled = new Array<boolean>(n).fill(false)
  filled[board.sourceIndex] = true
  const queue = [board.sourceIndex]

  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]
    for (let d = 0; d < 4; d++) {
      if (!(board.cells[c].mask & DIR_BIT[d])) continue
      const nb = neighbourIndex(board, c, d)
      if (nb < 0 || filled[nb]) continue
      if (!(board.cells[nb].mask & DIR_BIT[opposite(d)])) continue
      filled[nb] = true
      queue.push(nb)
    }
  }

  const leaks: LeakEnd[] = []
  for (let i = 0; i < n; i++) {
    if (!filled[i]) continue
    for (let d = 0; d < 4; d++) {
      if (!(board.cells[i].mask & DIR_BIT[d])) continue
      const nb = neighbourIndex(board, i, d)
      if (nb < 0 || !(board.cells[nb].mask & DIR_BIT[opposite(d)])) leaks.push({ index: i, dir: d })
    }
  }

  const basinsFed = board.basinIndexes.filter(i => filled[i]).length
  return { filled, leaks, basinsFed, solved: filled.every(Boolean) && leaks.length === 0 }
}

// ── Player actions ────────────────────────────────────────────────────────────

/** Whether tapping this cell does anything. A cross reads the same at every
 *  angle, so turning one is never a move. */
export function isRotatable(cell: Cell): boolean {
  return !cell.fixed && rotationPeriod(cell.solution) > 1
}

/** Taps this cell costs. Seized pieces are rusted and turn at double cost. */
export function moveCost(cell: Cell): number {
  return cell.seized ? 2 : 1
}

/** Turn one cell a quarter-turn clockwise. Returns the same board untouched if
 *  the cell can't turn, so callers can charge for the move iff it changed. */
export function rotateCellAt(board: Board, index: number): Board {
  const cell = board.cells[index]
  if (!cell || !isRotatable(cell)) return board
  const cells = board.cells.slice()
  cells[index] = { ...cell, mask: rotate(cell.mask, 1) }
  return { ...board, cells }
}

/** Snap one still-wrong cell to its correct orientation. Returns null when
 *  every cell already sits right (the board is solved, or only leaks remain
 *  from an alternative arrangement). */
export function dowse(board: Board, rng: Rng = Math.random): { board: Board; index: number } | null {
  const wrong = board.cells
    .map((c, i) => i)
    .filter(i => isRotatable(board.cells[i]) && board.cells[i].mask !== board.cells[i].solution)
  if (wrong.length === 0) return null
  const index = wrong[Math.floor(rng() * wrong.length)]
  const cells = board.cells.slice()
  cells[index] = { ...cells[index], mask: cells[index].solution }
  return { board: { ...board, cells }, index }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface RunScore {
  efficiency: number
  tickets:    number
  underPar:   boolean
}

/**
 * Taps against par. The floor means a sloppy solve still pays — brute-forcing
 * a hard board should be worse than solving an easy one cleanly, never
 * worthless. Finishing under par is possible where the board admits a shorter
 * arrangement than the one it was generated from.
 */
export function scoreRun(depth: DepthConfig, par: number, moves: number): RunScore {
  const { efficiencyFloor, underParBonus } = WELLSPRING_SCORING
  const ratio = moves > 0 ? par / moves : 1
  const efficiency = Math.min(1, Math.max(efficiencyFloor, ratio))
  const underPar = moves < par
  return {
    efficiency,
    underPar,
    tickets: Math.round(depth.ticketBase * efficiency) + (underPar ? underParBonus : 0),
  }
}

/** Crystals paid by a hub-world restoration, which earns no tickets at all. */
export function restorationCrystals(depth: DepthConfig, par: number, moves: number): number {
  return Math.round(depth.crystalBase * scoreRun(depth, par, moves).efficiency)
}
