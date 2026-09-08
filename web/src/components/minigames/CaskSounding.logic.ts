// ─── Cask Sounding — puzzle logic ─────────────────────────────────────────────
//
// A deduction puzzle: some casks on a cellar rack have gone to vinegar, you
// cannot see which, and you chalk the bad ones. Strike a cask to learn its
// state — a sound one also tells you how many of its eight neighbours are
// soured. Pure and React-free; the screen, the board component and the tests
// all read from here. See docs/minigame-cask-sounding.md for the design.
//
// The generator does no correctness work at all, and that is the point of the
// mechanic (§3): striking is always available, so every layout is finishable
// by anyone and there is no unsolvable board to guard against. What the solver
// in here is for is *par* — how few strikes a good player should need — which
// is the only thing skill shows up in.
//
// Only ROW counts are given to the player. Giving column counts too was
// measured to leave a median par of 2 on a 5x5, i.e. the board arrives nearly
// solved; see the doc's §3 table.

import TIER_DATA from '../../data/caskTiers.json'

// ── Tiers & scoring config ────────────────────────────────────────────────────

export interface CaskTier {
  id:          string
  label:       string
  subtitle:    string
  w:           number
  h:           number
  /** How many casks are soured. */
  soured:      number
  /** Empty rack slots, which break the 8-neighbourhood. */
  gaps:        number
  /** Rows the ledger never counted — the top tier's real difficulty lever. */
  hiddenRows:  number
  /** Boards easier than this are rejected and re-rolled. */
  parFloor:    number
  crystalBase: number
  vinegar:     number
}

export const CASK_TIERS = TIER_DATA.tiers as CaskTier[]

export const CASK_SCORING = TIER_DATA.scoring as {
  efficiencyFloor:  number
  underParCrystals: number
  badChalkCost:     number
  listenCost:       number
  reputation:       number
}

export type TierId = string

export function getTier(id: TierId): CaskTier {
  const tier = CASK_TIERS.find(t => t.id === id)
  if (!tier) throw new Error(`[CaskSounding] unknown tier: ${id}`)
  return tier
}

// ── Board model ───────────────────────────────────────────────────────────────

/**
 * What the player has established about a cask.
 *
 * `unknown`  — untouched.
 * `rung`     — struck and sound; `reading` holds its neighbour count. A cask
 *              wrongly chalked also ends up here, since the chalk rubbing off
 *              tells you the same thing a strike would have.
 * `soured`   — struck and bad. Counts as identified: no chalk needed.
 * `chalked`  — the player named it bad and was right.
 */
export type CaskState = 'unknown' | 'rung' | 'soured' | 'chalked'

export interface Cask {
  /** An empty slot in the rack: never soured, never a neighbour, never tappable. */
  gap:     boolean
  /** The hidden truth. Never read by the win check or by any player-facing path. */
  soured:  boolean
  state:   CaskState
  /** Soured neighbours, once the cask has rung. */
  reading: number | null
}

export interface Board {
  tierId:    TierId
  w:         number
  h:         number
  casks:     Cask[]
  /**
   * Soured casks per row, chalked on the rack end and free from the start.
   * `null` is a row the ledger never counted: the player gets no figure for it
   * and must work that row out from readings alone.
   */
  rowCounts: (number | null)[]
  /**
   * How many casks are soured in total. Always known — it is the first thing
   * the cellarer tells you, and with unlabelled rows it is no longer implied by
   * the row counts, so it has to be stated rather than derived.
   */
  souredTotal: number
  /** What the reference solver spends on this board. */
  par:       number
  /** What the player has spent, including bad-chalk and listen penalties. */
  soundings: number
}

export type Rng = () => number

/**
 * The eight cells touching `index`, skipping gaps and the rack edge. Every
 * part of the module — readings, the solver, the renderer — goes through this
 * one function, so a gap can never be counted in one place and not another.
 */
export function neighbourIndices(board: Pick<Board, 'w' | 'h' | 'casks'>, index: number): number[] {
  const { w, h, casks } = board
  const x = index % w
  const y = Math.floor(index / w)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const ni = ny * w + nx
      if (casks[ni].gap) continue
      out.push(ni)
    }
  }
  return out
}

/** How many of a cask's neighbours are soured — what a sound cask's ring says. */
export function readingAt(board: Pick<Board, 'w' | 'h' | 'casks'>, index: number): number {
  return neighbourIndices(board, index).filter(i => board.casks[i].soured).length
}

// ── Generation ────────────────────────────────────────────────────────────────

function shuffled(items: number[], rng: Rng): number[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Lay out one candidate rack: gaps scattered, then soured casks among the rest. */
function layOutRack(tier: CaskTier, rng: Rng): Board {
  const size = tier.w * tier.h
  const casks: Cask[] = Array.from({ length: size }, () => ({
    gap: false, soured: false, state: 'unknown' as CaskState, reading: null,
  }))

  const order = shuffled(Array.from({ length: size }, (_, i) => i), rng)
  for (const i of order.slice(0, tier.gaps)) casks[i].gap = true
  for (const i of order.slice(tier.gaps, tier.gaps + tier.soured)) casks[i].soured = true

  const rowCounts: (number | null)[] = []
  for (let y = 0; y < tier.h; y++) {
    let n = 0
    for (let x = 0; x < tier.w; x++) if (casks[y * tier.w + x].soured) n++
    rowCounts.push(n)
  }
  // Blank out the tier's unlabelled rows. Removing a free clue is the dial that
  // measurably moves difficulty; density and gaps were not enough on their own
  // to make the Vault harder than the Cellar (design §4).
  for (const y of shuffled(Array.from({ length: tier.h }, (_, i) => i), rng).slice(0, tier.hiddenRows)) {
    rowCounts[y] = null
  }

  return {
    tierId: tier.id, w: tier.w, h: tier.h, casks, rowCounts,
    souredTotal: tier.soured, par: 0, soundings: 0,
  }
}

/**
 * Generate a board and compute its par.
 *
 * There is nothing to certify here — any layout is playable (§3) — so the only
 * rejection is a board whose par falls under the tier's floor, which would be
 * a puzzle that solves itself.
 */
export function generateBoard(tier: CaskTier, rng: Rng = Math.random): Board {
  const MAX_ATTEMPTS = 40
  let last: Board | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = layOutRack(tier, rng)
    // The cellarer's own mark: one cask already known sound, so there is
    // somewhere to reason from before spending anything. It does not count
    // against the player's soundings, and par is computed with it in hand.
    const soundCasks = board.casks
      .map((c, i) => (!c.gap && !c.soured ? i : -1))
      .filter(i => i >= 0)
    if (soundCasks.length === 0) continue
    const opener = soundCasks[Math.floor(rng() * soundCasks.length)]
    board.casks[opener] = {
      ...board.casks[opener], state: 'rung', reading: readingAt(board, opener),
    }

    board.par = computePar(board)
    last = board
    if (board.par >= tier.parFloor) return board
  }

  // Every attempt came in under the floor. Returning the last one is correct:
  // an easy board is still a valid, finishable board, and refusing to hand the
  // player anything would be strictly worse than handing them a soft one.
  return last ?? layOutRack(tier, rng)
}

// ── The solver ────────────────────────────────────────────────────────────────

/** What the player knows about one cask, as the solver sees it. */
interface Known {
  soured:   boolean
  /** Neighbour count, for a cask known sound because it was struck. */
  reading?: number
}

/**
 * Cap on enumerated layouts. Early in a board the consistent set is enormous;
 * the cap bounds the work at the cost of the solver seeing only a sample. It
 * under-resolves rather than mis-resolves — a cask it calls ambiguous may in
 * truth be forced — which inflates par slightly and never makes a board
 * unfinishable.
 */
const SOLUTION_CAP = 20000

/**
 * Every layout consistent with the row counts and what is known so far.
 *
 * Enumerated row by row: each row picks which of its free cells are soured to
 * meet that row's count, and a partial check prunes as soon as a struck cask's
 * neighbourhood is decided. Doing it row-wise is what keeps this affordable —
 * the row counts collapse the search that a flat cell-by-cell walk would face.
 */
export function enumerateLayouts(
  board: Pick<Board, 'w' | 'h' | 'casks' | 'rowCounts' | 'souredTotal'>,
  known: Map<number, Known>,
  cap: number = SOLUTION_CAP,
): Uint8Array[] {
  const { w, h, casks, rowCounts, souredTotal } = board
  const size = w * h
  const neighbours: number[][] = []
  for (let i = 0; i < size; i++) neighbours.push(casks[i].gap ? [] : neighbourIndices(board, i))

  const out: Uint8Array[] = []
  const cur = new Uint8Array(size)

  /** Non-gap cells strictly below row y — the most that could still be soured. */
  const capacityBelow: number[] = new Array(h).fill(0)
  for (let y = h - 2; y >= 0; y--) {
    let row = 0
    for (let x = 0; x < w; x++) if (!casks[(y + 1) * w + x].gap) row++
    capacityBelow[y] = capacityBelow[y + 1] + row
  }

  /** Rows 0..y are laid. Check every struck cask whose window they touch. */
  function partialOk(y: number): boolean {
    for (const [i, k] of known) {
      if (k.soured || k.reading === undefined) continue
      const iy = Math.floor(i / w)
      if (iy > y + 1) continue          // its window has not been reached yet
      let decided = 0
      let pending = 0
      for (const n of neighbours[i]) {
        if (Math.floor(n / w) <= y) decided += cur[n]
        else pending++
      }
      if (decided > k.reading) return false
      if (decided + pending < k.reading) return false
    }
    return true
  }

  /** Soured casks still to place below row `y`, given what is laid so far. */
  function remainingBudget(y: number): number {
    let placed = 0
    for (let i = 0; i < (y + 1) * w; i++) placed += cur[i]
    return souredTotal - placed
  }

  function rec(y: number): void {
    if (out.length >= cap) return
    if (y === h) {
      let total = 0
      for (let i = 0; i < size; i++) total += cur[i]
      if (total === souredTotal) out.push(cur.slice())
      return
    }

    const base = y * w
    const free: number[] = []
    let fixed = 0
    for (let x = 0; x < w; x++) {
      const i = base + x
      cur[i] = 0
      if (casks[i].gap) continue
      const k = known.get(i)
      if (k) {
        if (k.soured) { cur[i] = 1; fixed++ }
        continue
      }
      free.push(i)
    }

    // Walk every way of putting `left` soured casks among this row's free cells.
    const choose = (start: number, left: number): void => {
      if (out.length >= cap) return
      if (left === 0) {
        // Prune on the total as well as the readings: a partial rack that has
        // already overspent the soured budget, or cannot reach it with every
        // remaining cell, is dead however well its readings line up.
        const budget = remainingBudget(y)
        if (budget < 0 || budget > capacityBelow[y]) return
        if (partialOk(y)) rec(y + 1)
        return
      }
      for (let s = start; s <= free.length - left; s++) {
        cur[free[s]] = 1
        choose(s + 1, left - 1)
        cur[free[s]] = 0
        if (out.length >= cap) return
      }
    }

    const declared = rowCounts[y]
    if (declared === null) {
      // An unlabelled row: any number of its casks could be bad, so every
      // subset is on the table. This is what makes the clue expensive to
      // remove — and why it is the lever that actually moves difficulty.
      for (let need = 0; need <= free.length; need++) {
        choose(0, need)
        if (out.length >= cap) break
      }
    } else {
      const need = declared - fixed
      if (need >= 0 && need <= free.length) choose(0, need)
    }
    for (const i of free) cur[i] = 0
  }

  rec(0)
  return out
}

/** What the player currently knows, read off the board's states only. */
function knownFrom(board: Board): Map<number, Known> {
  const known = new Map<number, Known>()
  board.casks.forEach((c, i) => {
    if (c.state === 'rung')    known.set(i, { soured: false, reading: c.reading ?? 0 })
    if (c.state === 'soured')  known.set(i, { soured: true })
    if (c.state === 'chalked') known.set(i, { soured: true })
  })
  return known
}

/**
 * Casks that are soured in every consistent layout, and so can be chalked with
 * certainty. Used by the reference solver and by `listen`; never to act on the
 * player's behalf during play (see the doc's §2 — auto-resolve was cut because
 * an exhaustive solver out-deduces the player on every board).
 */
function forcedSoured(layouts: Uint8Array[], size: number, known: Map<number, Known>): number[] {
  if (layouts.length === 0) return []
  const out: number[] = []
  for (let i = 0; i < size; i++) {
    if (known.has(i)) continue
    if (layouts.every(l => l[i] === 1)) out.push(i)
  }
  return out
}

/** Whether any cask not yet known could still be soured in some layout. */
function anyAmbiguousSoured(layouts: Uint8Array[], size: number, known: Map<number, Known>): boolean {
  for (let i = 0; i < size; i++) {
    if (known.has(i)) continue
    const some = layouts.some(l => l[i] === 1)
    const all  = layouts.every(l => l[i] === 1)
    if (some && !all) return true      // could be either — the player cannot chalk it
  }
  return false
}

/**
 * Par: what the reference solver spends on this board.
 *
 * It propagates to exhaustion, and when stuck strikes the cask whose reading it
 * can predict least — the question with the most information in it. It stops as
 * soon as every soured cask is *forced* soured, because from there the player
 * chalks the rest for free. That is a weaker stopping rule than "the whole rack
 * is determined": an ambiguous cask that is sound in every layout needs no
 * action, so it never costs a strike.
 *
 * Par is exact for this strategy and not a proven optimum over all strategies —
 * computing that is a game-tree minimax over hidden states and is not worth it.
 * Which is deliberate: it leaves under-par reachable for a player who picks a
 * better question than the reference did.
 */
export function referencePlay(board: Board): number[] {
  const size = board.w * board.h
  const known = knownFrom(board)
  const struck: number[] = []

  for (let guard = 0; guard <= size; guard++) {
    const layouts = enumerateLayouts(board, known)
    if (layouts.length === 0) return struck           // over-constrained; nothing left to ask
    if (!anyAmbiguousSoured(layouts, size, known)) return struck

    let best = -1
    let bestEntropy = -1
    for (let i = 0; i < size; i++) {
      if (known.has(i) || board.casks[i].gap) continue
      const groups = new Map<string, number>()
      for (const l of layouts) {
        const key = l[i] === 1
          ? 'S'
          : `N${neighbourIndices(board, i).reduce((n, j) => n + l[j], 0)}`
        groups.set(key, (groups.get(key) ?? 0) + 1)
      }
      let entropy = 0
      for (const c of groups.values()) {
        const p = c / layouts.length
        entropy -= p * Math.log2(p)
      }
      if (entropy > bestEntropy) { bestEntropy = entropy; best = i }
    }
    if (best < 0) return struck

    known.set(best, board.casks[best].soured
      ? { soured: true }
      : { soured: false, reading: readingAt(board, best) })
    struck.push(best)
  }
  return struck
}

/** Par is the length of that run. Split out so tests can replay the run itself. */
export function computePar(board: Board): number {
  return referencePlay(board).length
}

// ── Player actions ────────────────────────────────────────────────────────────

/** Whether a cask can still be acted on. */
export function isActionable(cask: Cask): boolean {
  return !cask.gap && cask.state === 'unknown'
}

/** Strike a cask: it rings with a neighbour count, or thuds and is bad. Costs 1. */
export function strike(board: Board, index: number): Board {
  const cask = board.casks[index]
  if (!isActionable(cask)) return board
  const casks = board.casks.slice()
  casks[index] = cask.soured
    ? { ...cask, state: 'soured', reading: null }
    : { ...cask, state: 'rung', reading: readingAt(board, index) }
  return { ...board, casks, soundings: board.soundings + 1 }
}

export interface ChalkResult {
  board: Board
  /** The cask was in fact sound: the chalk rubbed off and it cost the penalty. */
  wasWrong: boolean
}

/**
 * Chalk a cask as soured. Free when right — the game never charges for knowing
 * something — and priced at `badChalkCost` when wrong, which is what stops
 * chalking being a cheaper probe than striking.
 */
export function chalk(board: Board, index: number): ChalkResult {
  const cask = board.casks[index]
  if (!isActionable(cask)) return { board, wasWrong: false }
  const casks = board.casks.slice()
  if (cask.soured) {
    casks[index] = { ...cask, state: 'chalked', reading: null }
    return { board: { ...board, casks }, wasWrong: false }
  }
  // Wrong: the player learns exactly what a strike would have told them, and
  // pays more than a strike would have cost.
  casks[index] = { ...cask, state: 'rung', reading: readingAt(board, index) }
  return {
    board: { ...board, casks, soundings: board.soundings + CASK_SCORING.badChalkCost },
    wasWrong: true,
  }
}

/**
 * The hint: chalk one cask that is certainly soured, for `listenCost`. It only
 * ever names a cask the readings already force, so it hands over work the
 * player could have done, never information they could not have had.
 */
export function listen(board: Board, rng: Rng = Math.random): { board: Board; index: number } | null {
  const known = knownFrom(board)
  const layouts = enumerateLayouts(board, known)
  const forced = forcedSoured(layouts, board.w * board.h, known)
    .filter(i => isActionable(board.casks[i]))

  // Nothing is forced yet — fall back to a cask that is genuinely soured, so
  // the hint is never a dead button on a board the player is stuck on.
  const pool = forced.length > 0
    ? forced
    : board.casks.map((c, i) => (isActionable(c) && c.soured ? i : -1)).filter(i => i >= 0)
  if (pool.length === 0) return null

  const index = pool[Math.floor(rng() * pool.length)]
  const casks = board.casks.slice()
  casks[index] = { ...casks[index], state: 'chalked', reading: null }
  return {
    board: { ...board, casks, soundings: board.soundings + CASK_SCORING.listenCost },
    index,
  }
}

/**
 * The cellar is sorted when every soured cask has been named — chalked, or
 * struck, which identifies it just as well. Sound casks need no action, which
 * is what keeps the endgame free of the "clear forty cells you already know are
 * safe" busywork.
 *
 * Reads only cask *states* against the hidden truth of which casks are soured;
 * it never compares against a stored solution arrangement.
 */
export function isSorted(board: Board): boolean {
  return board.casks.every(c =>
    !c.soured || c.state === 'chalked' || c.state === 'soured')
}

/** Soured casks still unnamed — the status bar's progress figure. */
export function remainingSoured(board: Board): number {
  return board.casks.filter(c =>
    c.soured && c.state !== 'chalked' && c.state !== 'soured').length
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface RunScore {
  efficiency: number
  crystals:   number
  underPar:   boolean
}

/**
 * Soundings against par, in the same shape as Wellspring's — two puzzles in one
 * hub should not score in two different languages. The floor means brute-forcing
 * the whole rack still pays, just less than solving an easier cellar cleanly.
 *
 * Cask Sounding is a hub-world game only: a sorted cellar pays crystals, cask
 * vinegar and town standing. There are no arcade tickets in it.
 */
export function scoreRun(tier: CaskTier, par: number, soundings: number): RunScore {
  const { efficiencyFloor, underParCrystals } = CASK_SCORING
  const ratio = soundings > 0 ? par / soundings : 1
  const efficiency = Math.min(1, Math.max(efficiencyFloor, ratio))
  const underPar = soundings < par
  return {
    efficiency,
    underPar,
    crystals: Math.round(tier.crystalBase * efficiency) + (underPar ? underParCrystals : 0),
  }
}
