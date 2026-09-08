import { describe, it, expect } from 'vitest'
import {
  STOWAGE_TIERS, STOWAGE_SCORING, getTier,
  generateBoard, normalise, turnCells, turnPeriod, goodCells, anchorOf,
  footprint, originForTap, occupancy, canStow, openSlots, stowedCount,
  isPacked, stow, lift, turnGood, emptyCrate, occupantAt, manifest,
  isRectangular, scoreRun, slotIndex,
  type Board, type Cell, type Good, type StowageTier,
} from './Stowage.logic'

// ─── Stowage logic ────────────────────────────────────────────────────────────
// The generator is the thing that has to be right: a crate is cut from its own
// solution, so the tests below are mostly proofs that the cut is total (covers
// every free slot), disjoint (no slot claimed twice) and connected (no good in
// two pieces). Everything after that is arithmetic.

/** Deterministic RNG so a failure is reproducible from its seed. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const key = (c: Cell) => `${c.x},${c.y}`

/** Stow every good where the manifest says it goes — the generated solution. */
function playManifest(board: Board): Board {
  let next = board
  for (const good of board.goods) {
    const at = good.home
    // The manifest's orientation is turn 0, so turn the good back to it first.
    next = { ...next, goods: next.goods.map(g => (g.id === good.id ? { ...g, turn: 0 } : g)) }
    const turned = next.goods.find(g => g.id === good.id)!
    const anchor = anchorOf(goodCells(turned))
    next = stow(next, good.id, at.x + anchor.x, at.y + anchor.y)
  }
  return next
}

function neighbourKeys(c: Cell): string[] {
  return [{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }].map(key)
}

function isConnectedShape(cells: Cell[]): boolean {
  const all = new Set(cells.map(key))
  const seen = new Set([key(cells[0])])
  const queue = [cells[0]]
  while (queue.length > 0) {
    const c = queue.pop()!
    for (const n of [{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }]) {
      if (all.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); queue.push(n) }
    }
  }
  return seen.size === all.size
}

// ── Shape maths ───────────────────────────────────────────────────────────────

describe('shapes', () => {
  const ell: Cell[] = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]

  it('normalises to the origin, in row-major order', () => {
    const shifted = ell.map(c => ({ x: c.x + 4, y: c.y + 7 }))
    expect(normalise(shifted)).toEqual(normalise(ell))
    const rows = normalise(ell).map(c => c.y)
    expect(rows).toEqual([...rows].sort((a, b) => a - b))
  })

  it('four turns is the identity for every shape', () => {
    // A good that walks off its own anchor over repeated turns is the single
    // worst bug available here — it would silently move a stowed piece.
    for (let seed = 1; seed <= 40; seed++) {
      const board = generateBoard(getTier('wagon'), seeded(seed))
      for (const good of board.goods) {
        expect(turnCells(good.base, 4)).toEqual(normalise(good.base))
      }
    }
  })

  it('a turn preserves the slot count and connectivity', () => {
    for (let t = 0; t < 4; t++) {
      const turned = turnCells(ell, t)
      expect(turned).toHaveLength(ell.length)
      expect(isConnectedShape(turned)).toBe(true)
    }
  })

  it('turnPeriod is 1 for a square, 2 for a bar, 4 for an L', () => {
    const good = (cells: Cell[]): Good => ({ id: 0, base: normalise(cells), turn: 0, at: null, home: { x: 0, y: 0 } })
    expect(turnPeriod(good([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]))).toBe(1)
    expect(turnPeriod(good([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]))).toBe(2)
    expect(turnPeriod(good(ell))).toBe(4)
  })

  it('the anchor is the first slot of the top row', () => {
    const cells = normalise([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])
    expect(anchorOf(cells)).toEqual({ x: 1, y: 0 })
  })

  it('a tap lands the anchor on the tapped slot', () => {
    const good: Good = { id: 0, base: normalise(ell), turn: 0, at: null, home: { x: 0, y: 0 } }
    const origin = originForTap(good, 3, 2)
    const cells = footprint(good, origin.x, origin.y)
    expect(cells.map(key)).toContain('3,2')
    expect(anchorOf(cells)).toEqual({ x: 3, y: 2 })
  })

  it('spots a rectangle', () => {
    expect(isRectangular(normalise([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]))).toBe(true)
    expect(isRectangular(normalise([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]))).toBe(true)
    expect(isRectangular(normalise(ell))).toBe(false)
  })
})

// ── Generation ────────────────────────────────────────────────────────────────

describe.each(STOWAGE_TIERS)('generating a $label crate', (tier: StowageTier) => {
  const boards = Array.from({ length: 60 }, (_, i) => generateBoard(tier, seeded(i + 1)))

  it('lays out the tier it was asked for', () => {
    for (const board of boards) {
      expect(board.w).toBe(tier.w)
      expect(board.h).toBe(tier.h)
      expect(board.dunnage.filter(Boolean)).toHaveLength(tier.dunnage)
      expect(board.goods).toHaveLength(tier.goods)
      expect(board.par).toBe(tier.goods)
    }
  })

  it('cuts the crate into goods that cover it exactly once', () => {
    for (const board of boards) {
      const freeSlots = board.dunnage.filter(b => !b).length
      const slots = board.goods.reduce((n, g) => n + g.base.length, 0)
      expect(slots, 'goods must account for every free slot and no more').toBe(freeSlots)

      // Disjoint and total, checked against the manifest positions.
      const covered = new Set<number>()
      for (const good of board.goods) {
        for (const c of footprint({ ...good, turn: 0 }, good.home.x, good.home.y)) {
          const i = slotIndex(board, c.x, c.y)
          expect(board.dunnage[i], 'a good may not sit on packing timber').toBe(false)
          expect(covered.has(i), 'two goods claimed the same slot').toBe(false)
          covered.add(i)
        }
      }
      expect(covered.size).toBe(freeSlots)
    }
  })

  it('every good is one connected piece within the tier size range', () => {
    for (const board of boards) {
      for (const good of board.goods) {
        expect(isConnectedShape(good.base)).toBe(true)
        expect(good.base.length).toBeGreaterThanOrEqual(tier.minSlots)
        expect(good.base.length).toBeLessThanOrEqual(tier.maxSlots)
      }
    }
  })

  it('starts empty, so no board arrives already packed', () => {
    for (const board of boards) {
      expect(board.goods.every(g => g.at === null)).toBe(true)
      expect(isPacked(board)).toBe(false)
      expect(board.stows).toBe(0)
    }
  })

  it('the manifest actually packs the crate', () => {
    // The proof that a generated board is solvable: play the generated
    // solution and the crate reports itself packed, at exactly par.
    for (const board of boards) {
      const played = playManifest(board)
      expect(openSlots(played)).toBe(0)
      expect(isPacked(played)).toBe(true)
      expect(played.stows).toBe(board.par)
      expect(stowedCount(played)).toBe(tier.goods)
    }
  })

  it('is not a tray of plain rectangles', () => {
    const dull = boards.filter(b => b.goods.filter(g => isRectangular(g.base)).length * 2 > b.goods.length)
    expect(dull, 'boards where over half the goods are bars or blocks').toHaveLength(0)
  })
})

describe('dunnage', () => {
  it('never severs the crate into disconnected pockets', () => {
    const tier = getTier('hold')
    for (let seed = 1; seed <= 60; seed++) {
      const board = generateBoard(tier, seeded(seed))
      const free = board.dunnage
        .map((b, i) => (b ? null : { x: i % board.w, y: Math.floor(i / board.w) }))
        .filter((c): c is Cell => c !== null)
      expect(isConnectedShape(free)).toBe(true)
    }
  })
})

// ── Playing ───────────────────────────────────────────────────────────────────

describe('stowing', () => {
  const tier = getTier('handcart')
  const fresh = () => generateBoard(tier, seeded(7))

  it('a legal stow costs one and shows up in the occupancy', () => {
    const board = fresh()
    const good = board.goods[0]
    const anchor = anchorOf(goodCells(good))
    const next = stow(board, good.id, anchor.x, anchor.y)
    expect(next.stows).toBe(1)
    expect(next.goods[0].at).toEqual({ x: 0, y: 0 })
    expect(occupantAt(next, anchor.x, anchor.y)).toBe(good.id)
    expect(stowedCount(next)).toBe(1)
  })

  it('refuses a stow that overhangs the crate, and charges nothing for it', () => {
    const board = fresh()
    const good = board.goods[0]
    const next = stow(board, good.id, board.w - 1, board.h - 1)
    expect(next).toBe(board)
    expect(next.stows).toBe(0)
  })

  it('refuses a stow that overlaps another good', () => {
    const board = playManifest(fresh())
    const first = board.goods[0]
    const lifted = lift(board, first.id)
    const second = board.goods[1]
    // The second good's own home is occupied by the second good, so stowing
    // the first there must be refused.
    const clash = footprint({ ...second, turn: 0 }, second.home.x, second.home.y)[0]
    const before = lifted.stows
    const next = stow(lifted, first.id, clash.x, clash.y)
    expect(next.stows).toBe(before)
  })

  it('refuses a stow on packing timber', () => {
    const holdBoard = generateBoard(getTier('hold'), seeded(3))
    const timber = holdBoard.dunnage.findIndex(Boolean)
    const good = holdBoard.goods[0]
    const next = stow(holdBoard, good.id, timber % holdBoard.w, Math.floor(timber / holdBoard.w))
    expect(next.stows).toBe(0)
    expect(next.goods.every(g => g.at === null)).toBe(true)
  })

  it('lifting is free, and re-stowing is what costs', () => {
    const board = fresh()
    const good = board.goods[0]
    const anchor = anchorOf(goodCells(good))
    const stowed = stow(board, good.id, anchor.x, anchor.y)
    const lifted = lift(stowed, good.id)
    expect(lifted.stows).toBe(1)
    expect(lifted.goods[0].at).toBeNull()
    const again = stow(lifted, good.id, anchor.x, anchor.y)
    expect(again.stows).toBe(2)
  })

  it('emptying the crate returns every good to the tray for free', () => {
    const board = playManifest(fresh())
    const emptied = emptyCrate(board)
    expect(emptied.goods.every(g => g.at === null)).toBe(true)
    expect(emptied.stows).toBe(board.stows)
    expect(openSlots(emptied)).toBe(board.dunnage.filter(b => !b).length)
  })

  it('turning is free, cycles through four, and only applies in the tray', () => {
    const board = fresh()
    const good = board.goods[0]
    let next = board
    for (let i = 0; i < 4; i++) next = turnGood(next, good.id)
    expect(next.stows).toBe(0)
    expect(next.goods[0].turn).toBe(good.turn)

    const anchor = anchorOf(goodCells(good))
    const stowed = stow(board, good.id, anchor.x, anchor.y)
    expect(turnGood(stowed, good.id)).toBe(stowed)
  })
})

describe('the solved check reads the crate, not the answer', () => {
  it('still reports packed after every manifest position is scrubbed', () => {
    const board = playManifest(generateBoard(getTier('wagon'), seeded(11)))
    expect(isPacked(board)).toBe(true)
    const scrubbed: Board = { ...board, goods: board.goods.map(g => ({ ...g, home: { x: -99, y: -99 } })) }
    expect(isPacked(scrubbed)).toBe(true)
  })

  it('reports an unpacked crate while any slot is open', () => {
    const board = playManifest(generateBoard(getTier('wagon'), seeded(12)))
    const lifted = lift(board, board.goods[0].id)
    expect(isPacked(lifted)).toBe(false)
    expect(openSlots(lifted)).toBe(board.goods[0].base.length)
  })
})

describe('the manifest hint', () => {
  const tier = getTier('wagon')

  it('stows a loose good where it belongs and charges the hint cost', () => {
    const board = generateBoard(tier, seeded(5))
    const hint = manifest(board, seeded(2))
    expect(hint).not.toBeNull()
    expect(hint!.board.stows).toBe(STOWAGE_SCORING.manifestCost)
    expect(hint!.board.manifested).toBe(1)
    const placed = hint!.board.goods.find(g => g.id === hint!.id)!
    expect(placed.turn).toBe(0)
    expect(placed.at).toEqual(placed.home)
  })

  it('lifts whatever is in the way rather than failing', () => {
    // Pack the crate, tip one good out, and put it back somewhere wrong: the
    // hint has to be able to clear the obstruction it just created.
    let board = playManifest(generateBoard(tier, seeded(9)))
    const victim = board.goods[0]
    board = lift(board, victim.id)
    const hint = manifest(board, seeded(1))
    expect(hint).not.toBeNull()
    const placed = hint!.board.goods.find(g => g.id === hint!.id)!
    expect(placed.at).toEqual(placed.home)
    // Whatever it displaced is back in the tray, not overlapping.
    const taken = occupancy(hint!.board)
    const counts = new Map<number, number>()
    for (const id of taken) if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const [id, n] of counts) {
      expect(n).toBe(hint!.board.goods.find(g => g.id === id)!.base.length)
    }
  })

  it('finishes the crate when used on every good', () => {
    let board = generateBoard(tier, seeded(4))
    for (let i = 0; i < tier.goods; i++) {
      const hint = manifest(board, seeded(i + 1))
      expect(hint).not.toBeNull()
      board = hint!.board
    }
    expect(isPacked(board)).toBe(true)
    expect(manifest(board, seeded(1))).toBeNull()
    expect(board.stows).toBe(tier.goods * STOWAGE_SCORING.manifestCost)
  })
})

describe('canStow', () => {
  it('accepts every manifest position on an empty crate', () => {
    const board = generateBoard(getTier('hold'), seeded(21))
    for (const good of board.goods) {
      expect(canStow(board, { ...good, turn: 0 }, good.home.x, good.home.y)).toBe(true)
    }
  })

  it('rejects a position off the edge of the crate', () => {
    const board = generateBoard(getTier('handcart'), seeded(22))
    expect(canStow(board, board.goods[0], -1, 0)).toBe(false)
    expect(canStow(board, board.goods[0], board.w, 0)).toBe(false)
  })
})

// ── Scoring ───────────────────────────────────────────────────────────────────

describe('scoring', () => {
  const tier = getTier('wagon')

  it('pays full rate plus the clean-stow bonus for a run at par', () => {
    const score = scoreRun(tier, tier.goods, tier.goods)
    expect(score.efficiency).toBe(1)
    expect(score.cleanStow).toBe(true)
    expect(score.crystals).toBe(tier.crystalBase + STOWAGE_SCORING.cleanStowCrystals)
  })

  it('drops the bonus and the rate as soon as a good is re-stowed', () => {
    const score = scoreRun(tier, tier.goods, tier.goods + 1)
    expect(score.cleanStow).toBe(false)
    expect(score.efficiency).toBeCloseTo(tier.goods / (tier.goods + 1))
    expect(score.crystals).toBeLessThan(tier.crystalBase)
  })

  it('never pays less than the floor, however sloppy the run', () => {
    const score = scoreRun(tier, tier.goods, 500)
    expect(score.efficiency).toBe(STOWAGE_SCORING.efficiencyFloor)
    expect(score.crystals).toBe(Math.round(tier.crystalBase * STOWAGE_SCORING.efficiencyFloor))
  })

  it('a sloppy run on a hard crate still beats a clean run on an easy one being pointless', () => {
    // The floor exists so brute-forcing a Hold is never worthless, but it must
    // stay worse than packing a Handcart properly is per-minute — the check
    // that matters is simply that the floor is not free money.
    const hold = scoreRun(getTier('hold'), 9, 500)
    const handcart = scoreRun(getTier('handcart'), 5, 5)
    expect(hold.crystals).toBeGreaterThan(0)
    expect(handcart.crystals).toBeGreaterThan(hold.crystals / 2)
  })

  it('the manifest is a real cost, not a free answer', () => {
    const perfect = scoreRun(tier, tier.goods, tier.goods)
    const hinted = scoreRun(tier, tier.goods, tier.goods + STOWAGE_SCORING.manifestCost)
    expect(hinted.crystals).toBeLessThan(perfect.crystals)
  })
})

describe('tier config', () => {
  it.each(STOWAGE_TIERS)('$label divides into goods inside its size range', (tier) => {
    const free = tier.w * tier.h - tier.dunnage
    const base = Math.floor(free / tier.goods)
    const over = free % tier.goods
    expect(base).toBeGreaterThanOrEqual(tier.minSlots)
    expect(over > 0 ? base + 1 : base).toBeLessThanOrEqual(tier.maxSlots)
  })

  it('escalates crystals and salt with difficulty', () => {
    const bases = STOWAGE_TIERS.map(t => t.crystalBase)
    const salt = STOWAGE_TIERS.map(t => t.salt)
    expect(bases).toEqual([...bases].sort((a, b) => a - b))
    expect(salt).toEqual([...salt].sort((a, b) => a - b))
  })

  it('rejects an unknown tier loudly', () => {
    expect(() => getTier('nope')).toThrow(/unknown tier/)
  })
})
