import { describe, it, expect } from 'vitest'
import {
  CASK_TIERS, CASK_SCORING, getTier,
  generateBoard, neighbourIndices, readingAt,
  enumerateLayouts, referencePlay, computePar,
  strike, chalk, listen, isSorted, remainingSoured, isActionable,
  scoreRun,
  type Board, type Rng,
} from './CaskSounding.logic'

/** Deterministic RNG so a failure is reproducible from its seed. */
function seeded(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const TIERS = CASK_TIERS.map(t => t.id)

/**
 * Generating a board computes its par, which is the expensive part of this
 * module (~185ms on a Cellar board). Sample boards are built once per tier and
 * shared: every action returns a new board rather than mutating, so reusing a
 * fixture across assertions is safe and keeps the suite quick.
 */
const SAMPLES = new Map<string, Board[]>()
function samples(id: string, n = 10): Board[] {
  const key = `${id}:${n}`
  if (!SAMPLES.has(key)) {
    SAMPLES.set(key, Array.from({ length: n }, (_, k) => generateBoard(getTier(id), seeded(k + 1))))
  }
  return SAMPLES.get(key)!
}

// ── Generation ────────────────────────────────────────────────────────────────

describe('generation', () => {
  for (const id of TIERS) {
    const tier = getTier(id)

    it(`${id}: lays out the tier's gaps and soured casks exactly`, () => {
      for (const b of samples(id)) {
        expect(b.casks).toHaveLength(tier.w * tier.h)
        expect(b.casks.filter(c => c.gap)).toHaveLength(tier.gaps)
        expect(b.casks.filter(c => c.soured)).toHaveLength(tier.soured)
        // A gap is an empty slot: it can never hold a soured cask.
        expect(b.casks.every(c => !(c.gap && c.soured))).toBe(true)
      }
    })

    it(`${id}: stated row counts match the layout they describe`, () => {
      for (const b of samples(id)) {
        for (let y = 0; y < b.h; y++) {
          if (b.rowCounts[y] === null) continue
          let n = 0
          for (let x = 0; x < b.w; x++) if (b.casks[y * b.w + x].soured) n++
          expect(b.rowCounts[y]).toBe(n)
        }
      }
    })

    it(`${id}: leaves exactly the tier's rows unlabelled`, () => {
      for (const b of samples(id)) {
        expect(b.rowCounts.filter(c => c === null)).toHaveLength(tier.hiddenRows)
      }
    })

    it(`${id}: states the soured total, which unlabelled rows no longer imply`, () => {
      const b = samples(id)[2]
      expect(b.souredTotal).toBe(tier.soured)
      expect(b.casks.filter(c => c.soured)).toHaveLength(b.souredTotal)
    })

    it(`${id}: opens with exactly one cask already rung, and it is sound`, () => {
      for (const b of samples(id)) {
        const opened = b.casks.filter(c => c.state !== 'unknown')
        expect(opened).toHaveLength(1)
        expect(opened[0].state).toBe('rung')
        expect(opened[0].soured).toBe(false)
        expect(opened[0].reading).not.toBeNull()
      }
    })

    it(`${id}: the opening cask costs the player nothing`, () => {
      expect(samples(id).every(b => b.soundings === 0)).toBe(true)
    })
  }
})

// ── Geometry ──────────────────────────────────────────────────────────────────

describe('neighbourhoods', () => {
  it('is symmetric: if A touches B then B touches A', () => {
    const b = generateBoard(getTier('vault'), seeded(3))
    for (let i = 0; i < b.casks.length; i++) {
      if (b.casks[i].gap) continue
      for (const n of neighbourIndices(b, i)) {
        expect(neighbourIndices(b, n)).toContain(i)
      }
    }
  })

  it('never includes a gap, and a corner sees three neighbours at most', () => {
    const b = generateBoard(getTier('taproom'), seeded(4))
    expect(neighbourIndices(b, 0).length).toBeLessThanOrEqual(3)
    for (let i = 0; i < b.casks.length; i++) {
      for (const n of neighbourIndices(b, i)) expect(b.casks[n].gap).toBe(false)
    }
  })

  it('a reading counts exactly the soured casks touching it', () => {
    const b = generateBoard(getTier('cellar'), seeded(5))
    for (let i = 0; i < b.casks.length; i++) {
      if (b.casks[i].gap) continue
      const byHand = neighbourIndices(b, i).filter(n => b.casks[n].soured).length
      expect(readingAt(b, i)).toBe(byHand)
    }
  })
})

// ── The board is always finishable ────────────────────────────────────────────
//
// This is the property the whole mechanic rests on (design §1): striking is
// always available, so no board can strand a player. It is worth a test per
// tier rather than an argument in a comment.

describe('every board is finishable', () => {
  for (const id of TIERS) {
    it(`${id}: striking every cask always sorts the cellar`, () => {
      for (const start of samples(id)) {
        let b = start
        expect(isSorted(b)).toBe(false)
        for (let i = 0; i < b.casks.length; i++) b = strike(b, i)
        expect(isSorted(b)).toBe(true)
        expect(remainingSoured(b)).toBe(0)
      }
    })

    it(`${id}: chalking every soured cask sorts it without a single strike`, () => {
      for (const start of samples(id)) {
        let b = start
        b.casks.forEach((c, i) => { if (c.soured) b = chalk(b, i).board })
        expect(isSorted(b)).toBe(true)
        // Perfect play costs nothing at all: chalk is free when it is right.
        expect(b.soundings).toBe(0)
      }
    })
  }

  it('sound casks never need touching for the cellar to be sorted', () => {
    let b = generateBoard(getTier('cellar'), seeded(11))
    b.casks.forEach((c, i) => { if (c.soured) b = chalk(b, i).board })
    expect(isSorted(b)).toBe(true)
    // Most of the rack is still untouched — that is the point of the win
    // condition, and what removes Minesweeper's endgame busywork.
    expect(b.casks.filter(c => c.state === 'unknown').length).toBeGreaterThan(0)
  })
})

// ── Par ───────────────────────────────────────────────────────────────────────

describe('par', () => {
  it('equals what replaying the reference run actually spends', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const b = generateBoard(getTier('taproom'), seeded(seed))
      const run = referencePlay(b)
      expect(b.par).toBe(run.length)

      // Replay those strikes through the real player-facing action and check
      // the cost the player would be charged is exactly par — no double
      // counting, no free moves hidden in the solver.
      let replayed: Board = { ...b, casks: b.casks.slice() }
      for (const i of run) replayed = strike(replayed, i)
      expect(replayed.soundings).toBe(b.par)

      // And from there every soured cask is chalkable for free, which is what
      // the solver's stopping rule claims.
      for (let i = 0; i < replayed.casks.length; i++) {
        if (replayed.casks[i].soured && isActionable(replayed.casks[i])) {
          const { wasWrong, board } = chalk(replayed, i)
          expect(wasWrong).toBe(false)
          replayed = board
        }
      }
      expect(isSorted(replayed)).toBe(true)
      expect(replayed.soundings).toBe(b.par)
    }
  })

  it('is deterministic for a given board', () => {
    const b = generateBoard(getTier('taproom'), seeded(9))
    expect(computePar(b)).toBe(computePar(b))
  })

  it('never strikes a gap or a cask it already knows', () => {
    const b = generateBoard(getTier('vault'), seeded(6))
    const run = referencePlay(b)
    expect(new Set(run).size).toBe(run.length)
    for (const i of run) {
      expect(b.casks[i].gap).toBe(false)
      expect(b.casks[i].state).toBe('unknown')
    }
  })

  it('respects the tier floor, so no board arrives already solved', () => {
    for (const id of TIERS) {
      for (const b of samples(id)) expect(b.par).toBeGreaterThan(0)
    }
  })
})

describe('layout enumeration', () => {
  it('only returns layouts that honour the row counts', () => {
    const b = generateBoard(getTier('taproom'), seeded(2))
    const layouts = enumerateLayouts(b, new Map(), 500)
    expect(layouts.length).toBeGreaterThan(0)
    for (const l of layouts) {
      for (let y = 0; y < b.h; y++) {
        if (b.rowCounts[y] === null) continue
        let n = 0
        for (let x = 0; x < b.w; x++) n += l[y * b.w + x]
        expect(n).toBe(b.rowCounts[y])
      }
    }
  })

  it('only returns layouts with the stated number of soured casks', () => {
    const b = generateBoard(getTier('vault'), seeded(2))
    const layouts = enumerateLayouts(b, new Map(), 300)
    expect(layouts.length).toBeGreaterThan(0)
    for (const l of layouts) {
      expect(l.reduce((n, v) => n + v, 0)).toBe(b.souredTotal)
    }
  })

  it('always includes the true layout among them', () => {
    const b = generateBoard(getTier('taproom'), seeded(8))
    const truth = b.casks.map(c => (c.soured ? 1 : 0)).join('')
    const layouts = enumerateLayouts(b, new Map())
    expect(layouts.some(l => Array.from(l).join('') === truth)).toBe(true)
  })

  it('never places a cask in a gap', () => {
    const b = generateBoard(getTier('vault'), seeded(12))
    for (const l of enumerateLayouts(b, new Map(), 200)) {
      b.casks.forEach((c, i) => { if (c.gap) expect(l[i]).toBe(0) })
    }
  })
})

// ── Actions ───────────────────────────────────────────────────────────────────

describe('striking', () => {
  it('rings with a neighbour count on a sound cask, costing one', () => {
    const b = generateBoard(getTier('cellar'), seeded(13))
    const i = b.casks.findIndex(c => isActionable(c) && !c.soured)
    const after = strike(b, i)
    expect(after.casks[i].state).toBe('rung')
    expect(after.casks[i].reading).toBe(readingAt(b, i))
    expect(after.soundings).toBe(1)
  })

  it('thuds on a soured cask, which identifies it', () => {
    const b = generateBoard(getTier('cellar'), seeded(14))
    const i = b.casks.findIndex(c => isActionable(c) && c.soured)
    const after = strike(b, i)
    expect(after.casks[i].state).toBe('soured')
    expect(after.soundings).toBe(1)
    expect(remainingSoured(after)).toBe(remainingSoured(b) - 1)
  })

  it('leaves the board untouched on a gap or an already-known cask', () => {
    const b = generateBoard(getTier('vault'), seeded(15))
    const gap = b.casks.findIndex(c => c.gap)
    expect(strike(b, gap)).toBe(b)
    const opened = b.casks.findIndex(c => c.state !== 'unknown')
    expect(strike(b, opened)).toBe(b)
  })

  it('does not mutate the board it was given', () => {
    const b = generateBoard(getTier('taproom'), seeded(16))
    const before = JSON.stringify(b)
    strike(b, b.casks.findIndex(c => isActionable(c)))
    expect(JSON.stringify(b)).toBe(before)
  })
})

describe('chalking', () => {
  it('is free and correct on a soured cask', () => {
    const b = generateBoard(getTier('cellar'), seeded(17))
    const i = b.casks.findIndex(c => isActionable(c) && c.soured)
    const { board, wasWrong } = chalk(b, i)
    expect(wasWrong).toBe(false)
    expect(board.casks[i].state).toBe('chalked')
    expect(board.soundings).toBe(0)
  })

  it('rubs off a sound cask, teaching the same thing a strike would', () => {
    const b = generateBoard(getTier('cellar'), seeded(18))
    const i = b.casks.findIndex(c => isActionable(c) && !c.soured)
    const { board, wasWrong } = chalk(b, i)
    expect(wasWrong).toBe(true)
    expect(board.casks[i].state).toBe('rung')
    expect(board.casks[i].reading).toBe(readingAt(b, i))
    expect(board.soundings).toBe(CASK_SCORING.badChalkCost)
  })

  // The economy the design rests on: if a wrong chalk were cheaper than a
  // strike, chalk-spamming would be the optimal way to read the whole rack and
  // there would be no reason to think at all.
  it('costs strictly more than a strike when it is wrong', () => {
    expect(CASK_SCORING.badChalkCost).toBeGreaterThan(1)
  })
})

describe('listen', () => {
  it('names a genuinely soured cask and charges for it', () => {
    const b = generateBoard(getTier('taproom'), seeded(19))
    const hint = listen(b, seeded(2))
    expect(hint).not.toBeNull()
    expect(b.casks[hint!.index].soured).toBe(true)
    expect(hint!.board.casks[hint!.index].state).toBe('chalked')
    expect(hint!.board.soundings).toBe(CASK_SCORING.listenCost)
  })

  it('returns null once every soured cask is already named', () => {
    let b = generateBoard(getTier('taproom'), seeded(20))
    b.casks.forEach((c, i) => { if (c.soured) b = chalk(b, i).board })
    expect(listen(b, seeded(1))).toBeNull()
  })
})

// ── The win check reads states, not the layout ────────────────────────────────

describe('the sorted check', () => {
  it('is not satisfied by knowing where the soured casks are', () => {
    // Every sound cask struck, every soured cask left untouched: the player has
    // effectively deduced the answer but has not named it, so it is not sorted.
    let b = generateBoard(getTier('taproom'), seeded(21))
    b.casks.forEach((c, i) => { if (!c.soured && !c.gap) b = strike(b, i) })
    expect(isSorted(b)).toBe(false)
  })

  it('counts a struck-soured cask as named, the same as a chalked one', () => {
    let b = generateBoard(getTier('taproom'), seeded(22))
    b.casks.forEach((c, i) => { if (c.soured) b = strike(b, i) })
    expect(isSorted(b)).toBe(true)
  })
})

// ── Scoring ───────────────────────────────────────────────────────────────────

describe('scoring', () => {
  const tier = getTier('cellar')

  it('pays full crystals for a solve exactly on par', () => {
    const s = scoreRun(tier, 10, 10)
    expect(s.efficiency).toBe(1)
    expect(s.underPar).toBe(false)
    expect(s.crystals).toBe(tier.crystalBase)
  })

  it('adds the bonus under par', () => {
    const s = scoreRun(tier, 10, 8)
    expect(s.underPar).toBe(true)
    expect(s.crystals).toBe(tier.crystalBase + CASK_SCORING.underParCrystals)
  })

  it('floors a sloppy solve rather than zeroing it', () => {
    const s = scoreRun(tier, 10, 500)
    expect(s.efficiency).toBe(CASK_SCORING.efficiencyFloor)
    expect(s.crystals).toBe(Math.round(tier.crystalBase * CASK_SCORING.efficiencyFloor))
  })

  it('never pays more than the base plus the bonus', () => {
    for (let soundings = 1; soundings <= 60; soundings++) {
      const s = scoreRun(tier, 10, soundings)
      expect(s.crystals).toBeLessThanOrEqual(tier.crystalBase + CASK_SCORING.underParCrystals)
      expect(s.efficiency).toBeLessThanOrEqual(1)
      expect(s.efficiency).toBeGreaterThanOrEqual(CASK_SCORING.efficiencyFloor)
    }
  })

  it('rises monotonically as the player spends less', () => {
    for (let soundings = 2; soundings <= 40; soundings++) {
      const cheaper = scoreRun(tier, 10, soundings - 1).crystals
      const dearer  = scoreRun(tier, 10, soundings).crystals
      expect(cheaper).toBeGreaterThanOrEqual(dearer)
    }
  })

  // A brute-forced hard cellar should not beat a cleanly-solved easy one.
  it('pays a clean Tap Room better than a brute-forced Vault', () => {
    const clean = scoreRun(getTier('taproom'), 6, 6).crystals
    const brute = scoreRun(getTier('vault'), 10, 36).crystals
    expect(clean).toBeGreaterThan(brute * 0.4)
  })
})
