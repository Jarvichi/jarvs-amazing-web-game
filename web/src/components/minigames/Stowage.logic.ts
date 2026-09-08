// ─── Stowage — packing logic ──────────────────────────────────────────────────
//
// A packing puzzle: a crate's load has been thrown in loose, and every good has
// to go back in with nothing left over and no slot wasted. Pure and React-free;
// the screen, the board components and the tests all read from here. See
// docs/minigame-stowage.md for the design.
//
// The generator does its correctness work up front and never needs a solver:
// a crate is built by *cutting a solved crate into pieces*, so the partition it
// hands back is itself a packing and no unsolvable board can exist. Par is the
// number of goods for the same reason — every good must be stowed once, so no
// run can be shorter, which is why the bonus here is for *hitting* par rather
// than beating it (§2).

import TIER_DATA from '../../data/stowageTiers.json'

// ── Tiers & scoring config ────────────────────────────────────────────────────

export interface StowageTier {
  id:       string
  label:    string
  subtitle: string
  w:        number
  h:        number
  /** Blocked slots — packing timber nothing can be stowed on. */
  dunnage:  number
  /** How many goods the load is cut into. Also the par. */
  goods:    number
  /** Slots per good; the partition keeps every piece inside this range. */
  minSlots: number
  maxSlots: number
  crystalBase: number
  /** Barrelled salt paid out for packing this crate. */
  salt:     number
}

export const STOWAGE_TIERS = TIER_DATA.tiers as StowageTier[]

export const STOWAGE_SCORING = TIER_DATA.scoring as {
  efficiencyFloor:   number
  cleanStowCrystals: number
  manifestCost:      number
  reputation:        number
}

export type TierId = string

export function getTier(id: TierId): StowageTier {
  const tier = STOWAGE_TIERS.find(t => t.id === id)
  if (!tier) throw new Error(`[Stowage] unknown tier: ${id}`)
  return tier
}

// ── Board model ───────────────────────────────────────────────────────────────

export type Rng = () => number

export interface Cell { x: number; y: number }

export interface Good {
  id: number
  /**
   * The good's shape at turn 0, normalised so the top-left of its bounding box
   * is (0, 0) and the cells are in row-major order. Every other orientation is
   * derived from this, never stored, so a good cannot drift off its own shape.
   */
  base: Cell[]
  /** Quarter turns clockwise currently applied, 0–3. */
  turn: number
  /** Bounding-box origin in the crate, or null while it is in the tray. */
  at:   Cell | null
  /**
   * Where the manifest says this good goes: its origin at turn 0. Only the
   * MANIFEST hint reads it — the solved check never does, and it is never
   * handed to a component, so there is nothing for a curious player to read
   * out of the DOM.
   */
  home: Cell
}

export interface Board {
  w: number
  h: number
  /** Slot-indexed: true where packing timber blocks the slot. */
  dunnage: boolean[]
  goods:   Good[]
  /** Stow actions spent. Lifting is free; re-stowing is what costs. */
  stows:   number
  /** Goods the manifest placed, for the result breakdown. */
  manifested: number
  par:     number
}

export function slotIndex(board: Pick<Board, 'w'>, x: number, y: number): number {
  return y * board.w + x
}

function inBounds(board: Pick<Board, 'w' | 'h'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.w && y < board.h
}

// ── Shapes ────────────────────────────────────────────────────────────────────

/** Row-major order, which is also what makes cells[0] the anchor (see below). */
function rowMajor(cells: Cell[]): Cell[] {
  return cells.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x))
}

/** Shift a shape so its bounding box starts at (0, 0), in row-major order. */
export function normalise(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map(c => c.x))
  const minY = Math.min(...cells.map(c => c.y))
  return rowMajor(cells.map(c => ({ x: c.x - minX, y: c.y - minY })))
}

/** One quarter turn clockwise: (x, y) → (−y, x), re-normalised. */
export function turnCells(cells: Cell[], turns = 1): Cell[] {
  let out = cells
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
    out = normalise(out.map(c => ({ x: -c.y, y: c.x })))
  }
  return normalise(out)
}

/** The good's cells at its current turn, normalised. */
export function goodCells(good: Good): Cell[] {
  return turnCells(good.base, good.turn)
}

/**
 * The slot a tap lands the good on: the first cell of its top row. Tapping a
 * crate slot puts *this* cell of the held good there, which is the rule the
 * tray's anchor dot exists to show.
 */
export function anchorOf(cells: Cell[]): Cell {
  return cells[0]
}

/** Where the good's cells sit in the crate if its origin is (ox, oy). */
export function footprint(good: Good, ox: number, oy: number): Cell[] {
  return goodCells(good).map(c => ({ x: c.x + ox, y: c.y + oy }))
}

/** The origin a tap on (tapX, tapY) implies, via the anchor rule above. */
export function originForTap(good: Good, tapX: number, tapY: number): Cell {
  const anchor = anchorOf(goodCells(good))
  return { x: tapX - anchor.x, y: tapY - anchor.y }
}

/**
 * How many distinct orientations a good has: 1 for a square or a 2×2, 2 for a
 * bar or an S, 4 for everything else. The UI disables TURN at 1 rather than
 * offering a button that visibly does nothing.
 */
export function turnPeriod(good: Good): number {
  const key = (cells: Cell[]) => cells.map(c => `${c.x},${c.y}`).join(' ')
  const base = key(normalise(good.base))
  for (let t = 1; t < 4; t++) {
    if (key(turnCells(good.base, t)) === base) return t
  }
  return 4
}

// ── Occupancy ─────────────────────────────────────────────────────────────────

/** Slot-indexed good ids, or null where the slot is empty. */
export function occupancy(board: Board): (number | null)[] {
  const out: (number | null)[] = new Array(board.w * board.h).fill(null)
  for (const good of board.goods) {
    if (!good.at) continue
    for (const c of footprint(good, good.at.x, good.at.y)) {
      out[slotIndex(board, c.x, c.y)] = good.id
    }
  }
  return out
}

/** Whether the good fits at this origin: inside the crate, clear of timber and
 *  clear of every other stowed good. Overlaps are refused at the tap rather
 *  than allowed and scored, so there is no illegal board state to check for. */
export function canStow(board: Board, good: Good, ox: number, oy: number): boolean {
  const taken = occupancy(board)
  for (const c of footprint(good, ox, oy)) {
    if (!inBounds(board, c.x, c.y)) return false
    const i = slotIndex(board, c.x, c.y)
    if (board.dunnage[i]) return false
    const by = taken[i]
    if (by !== null && by !== good.id) return false
  }
  return true
}

/** Free slots still to be covered. */
export function openSlots(board: Board): number {
  const taken = occupancy(board)
  let n = 0
  for (let i = 0; i < taken.length; i++) if (!board.dunnage[i] && taken[i] === null) n++
  return n
}

export function stowedCount(board: Board): number {
  return board.goods.filter(g => g.at !== null).length
}

/**
 * Solved when every free slot is covered.
 *
 * This reads the crate in front of it and nothing else — never a comparison
 * against `home` — so a player who finds an arrangement the generator never
 * thought of gets full credit for it. Because the goods' slots sum to exactly
 * the free-slot count, "no slot left open" and "every good stowed" are the same
 * statement, and overlaps cannot exist (canStow refuses them).
 */
export function isPacked(board: Board): boolean {
  return openSlots(board) === 0
}

// ── Actions ───────────────────────────────────────────────────────────────────

function replaceGood(board: Board, id: number, patch: Partial<Good>): Board {
  return { ...board, goods: board.goods.map(g => (g.id === id ? { ...g, ...patch } : g)) }
}

/** Turn a good in the tray. Free: charging for rotation would tax exactly the
 *  mental work the game is about. */
export function turnGood(board: Board, id: number): Board {
  const good = board.goods.find(g => g.id === id)
  if (!good || good.at) return board
  return replaceGood(board, id, { turn: (good.turn + 1) % 4 })
}

/** Stow the held good so its anchor lands on (tapX, tapY). A refused stow costs
 *  nothing — the board comes back unchanged. */
export function stow(board: Board, id: number, tapX: number, tapY: number): Board {
  const good = board.goods.find(g => g.id === id)
  if (!good) return board
  const origin = originForTap(good, tapX, tapY)
  if (!canStow(board, good, origin.x, origin.y)) return board
  const next = replaceGood(board, id, { at: origin })
  return { ...next, stows: board.stows + 1 }
}

/** Take a stowed good back out. Free — the re-stow is what costs. */
export function lift(board: Board, id: number): Board {
  const good = board.goods.find(g => g.id === id)
  if (!good || !good.at) return board
  return replaceGood(board, id, { at: null })
}

/** Tip the whole crate out. Also free, for the same reason lifting is. */
export function emptyCrate(board: Board): Board {
  return { ...board, goods: board.goods.map(g => (g.at ? { ...g, at: null } : g)) }
}

/** The good occupying a slot, or null. */
export function occupantAt(board: Board, x: number, y: number): number | null {
  return occupancy(board)[slotIndex(board, x, y)]
}

/**
 * MANIFEST: stow one good where the manifest says it goes, lifting anything in
 * the way back to the tray. Costs `manifestCost` stows.
 *
 * Lifting the obstruction rather than searching for some other legal home is
 * deliberate — it needs no solver, it always succeeds, and "the manifest says
 * this one goes here, so whatever is in the way comes out" is a rule a player
 * can predict before they spend on it.
 */
export function manifest(board: Board, rng: Rng = Math.random): { board: Board; id: number } | null {
  const loose = board.goods.filter(g => !g.at)
  if (loose.length === 0) return null
  const pick = loose[Math.floor(rng() * loose.length)]

  const target = footprint({ ...pick, turn: 0 }, pick.home.x, pick.home.y)
  const wanted = new Set(target.map(c => slotIndex(board, c.x, c.y)))

  let next = board
  for (const other of board.goods) {
    if (other.id === pick.id || !other.at) continue
    const clash = footprint(other, other.at.x, other.at.y)
      .some(c => wanted.has(slotIndex(board, c.x, c.y)))
    if (clash) next = lift(next, other.id)
  }

  next = replaceGood(next, pick.id, { turn: 0, at: { ...pick.home } })
  return {
    board: { ...next, stows: next.stows + STOWAGE_SCORING.manifestCost, manifested: next.manifested + 1 },
    id: pick.id,
  }
}

// ── Generation ────────────────────────────────────────────────────────────────

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function neighbours(tier: StowageTier, i: number): number[] {
  const x = i % tier.w, y = Math.floor(i / tier.w)
  const out: number[] = []
  if (y > 0)          out.push(i - tier.w)
  if (y < tier.h - 1) out.push(i + tier.w)
  if (x > 0)          out.push(i - 1)
  if (x < tier.w - 1) out.push(i + 1)
  return out
}

/** Whether every slot in `set` reaches every other through slots in `set`. */
function isConnected(tier: StowageTier, set: Set<number>): boolean {
  if (set.size === 0) return true
  const start = set.values().next().value as number
  const seen = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    for (const n of neighbours(tier, queue.pop()!)) {
      if (set.has(n) && !seen.has(n)) { seen.add(n); queue.push(n) }
    }
  }
  return seen.size === set.size
}

/** Timber placed so the free region stays in one piece: a severed pocket of
 *  slots is usually unpackable and always reads as a bug. */
function placeDunnage(tier: StowageTier, rng: Rng): boolean[] | null {
  const blocked = new Array(tier.w * tier.h).fill(false)
  if (tier.dunnage === 0) return blocked
  for (const i of shuffled(Array.from({ length: tier.w * tier.h }, (_, k) => k), rng)) {
    blocked[i] = true
    const free = new Set<number>()
    for (let k = 0; k < blocked.length; k++) if (!blocked[k]) free.add(k)
    if (!isConnected(tier, free)) { blocked[i] = false; continue }
    if (blocked.filter(Boolean).length === tier.dunnage) return blocked
  }
  return null
}

/** Target sizes for the goods: as even as the free-slot count allows. */
function targetSizes(free: number, tier: StowageTier, rng: Rng): number[] | null {
  const base = Math.floor(free / tier.goods)
  const over = free - base * tier.goods
  if (base < tier.minSlots || (over > 0 ? base + 1 : base) > tier.maxSlots) return null
  return shuffled(
    Array.from({ length: tier.goods }, (_, i) => (i < over ? base + 1 : base)),
    rng,
  )
}

/**
 * Cut the free region into connected goods by multi-source growth: seed every
 * good on its own slot, then repeatedly grow a random under-target good into a
 * random unclaimed neighbour. Growth only stops when no under-target good has
 * an unclaimed neighbour, and any slots left over then are handed to their
 * smallest adjacent good — so the partition always covers the crate, and every
 * piece is connected because it only ever grew (or merged) into a neighbour.
 *
 * Returns null where the result would break the tier's size range, which the
 * caller answers by re-rolling.
 */
function partition(tier: StowageTier, blocked: boolean[], rng: Rng): number[][] | null {
  const free = blocked.map((b, i) => (b ? -1 : i)).filter(i => i >= 0)
  const sizes = targetSizes(free.length, tier, rng)
  if (!sizes) return null

  const owner = new Map<number, number>()
  const regions: number[][] = []
  for (const [r, seed] of shuffled(free, rng).slice(0, tier.goods).entries()) {
    owner.set(seed, r)
    regions.push([seed])
  }
  if (regions.length < tier.goods) return null

  for (;;) {
    const hungry = regions
      .map((_, r) => r)
      .filter(r => regions[r].length < sizes[r] &&
        regions[r].some(c => neighbours(tier, c).some(n => !blocked[n] && !owner.has(n))))
    if (hungry.length === 0) break
    const r = hungry[Math.floor(rng() * hungry.length)]
    const open = regions[r].flatMap(c => neighbours(tier, c).filter(n => !blocked[n] && !owner.has(n)))
    const pick = open[Math.floor(rng() * open.length)]
    owner.set(pick, r)
    regions[r].push(pick)
  }

  // Slots boxed in behind finished goods. Each goes to its smallest neighbour,
  // which keeps that good connected and keeps the sizes as tight as possible.
  for (;;) {
    const stranded = free.filter(i => !owner.has(i))
    if (stranded.length === 0) break
    const next = stranded.find(i => neighbours(tier, i).some(n => owner.has(n)))
    if (next === undefined) return null
    const adjacent = neighbours(tier, next).filter(n => owner.has(n)).map(n => owner.get(n)!)
    const r = adjacent.reduce((best, cur) => (regions[cur].length < regions[best].length ? cur : best))
    owner.set(next, r)
    regions[r].push(next)
  }

  if (regions.some(cells => cells.length < tier.minSlots || cells.length > tier.maxSlots)) return null
  return regions
}

/** A good whose bounding box is completely full: a bar or a block. They fit
 *  almost anywhere, so a tray of them is tidying rather than packing. */
export function isRectangular(cells: Cell[]): boolean {
  const w = Math.max(...cells.map(c => c.x)) + 1
  const h = Math.max(...cells.map(c => c.y)) + 1
  return w * h === cells.length
}

function buildBoard(tier: StowageTier, rng: Rng): Board | null {
  const blocked = placeDunnage(tier, rng)
  if (!blocked) return null
  const regions = partition(tier, blocked, rng)
  if (!regions) return null

  const goods: Good[] = shuffled(regions, rng).map((cells, id) => {
    const points = cells.map(i => ({ x: i % tier.w, y: Math.floor(i / tier.w) }))
    return {
      id,
      base: normalise(points),
      turn: Math.floor(rng() * 4),
      at:   null,
      home: {
        x: Math.min(...points.map(p => p.x)),
        y: Math.min(...points.map(p => p.y)),
      },
    }
  })

  return {
    w: tier.w,
    h: tier.h,
    dunnage: blocked,
    goods,
    stows: 0,
    manifested: 0,
    par: goods.length,
  }
}

const MAX_ATTEMPTS = 200

/**
 * Lay out a crate. Re-rolls a layout that breaks the tier's size range, and
 * re-rolls a *dull* one — more than half the goods being plain rectangles —
 * keeping the first valid board as a fallback so this always terminates with
 * something playable.
 */
export function generateBoard(tier: StowageTier, rng: Rng = Math.random): Board {
  let fallback: Board | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = buildBoard(tier, rng)
    if (!board) continue
    fallback ??= board
    const dull = board.goods.filter(g => isRectangular(g.base)).length
    if (dull * 2 <= board.goods.length) return board
  }
  if (fallback) return fallback
  throw new Error(`[Stowage] could not lay out a ${tier.id} crate`)
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface RunScore {
  efficiency: number
  crystals:   number
  /** Every good stowed right the first time. Par is a floor here, so this is
   *  the shape the other hub puzzles' under-par bonus takes. */
  cleanStow:  boolean
}

export function scoreRun(tier: StowageTier, par: number, stows: number): RunScore {
  const efficiency = Math.min(1, Math.max(STOWAGE_SCORING.efficiencyFloor, par / Math.max(stows, 1)))
  const cleanStow = stows === par
  return {
    efficiency,
    cleanStow,
    crystals: Math.round(tier.crystalBase * efficiency)
      + (cleanStow ? STOWAGE_SCORING.cleanStowCrystals : 0),
  }
}
