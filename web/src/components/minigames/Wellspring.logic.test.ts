import { describe, it, expect } from 'vitest'
import { hashStr, makeSeededRng } from '../../game/seededRandom'
import {
  DIR_BIT, NORTH, EAST, SOUTH, WEST, opposite, rotate, rotationPeriod, stepsBetween,
  pieceKind, neighbourIndex, generateBoard, computeFlow, rotateCellAt, isRotatable,
  moveCost, dowse, scoreRun, getDepth,
  WELLSPRING_DEPTHS, WELLSPRING_SCORING,
  type Board, type DepthConfig, type Rng,
} from './Wellspring.logic'

const N = DIR_BIT[NORTH]
const E = DIR_BIT[EAST]
const S = DIR_BIT[SOUTH]
const W = DIR_BIT[WEST]

const STRAIGHT = N | S
const ELBOW    = N | E
const TEE      = N | E | S
const CROSS    = N | E | S | W

/** Enough seeds to catch a generator that only usually works. */
const SEEDS = 300

function rngFor(label: string): Rng {
  return makeSeededRng(hashStr(label))
}

/** Every cell turned to the orientation it was generated at. */
function atSolution(board: Board): Board {
  return { ...board, cells: board.cells.map(c => ({ ...c, mask: c.solution })) }
}

// ── Masks & rotation ──────────────────────────────────────────────────────────

describe('rotation', () => {
  it('carries each open side one step clockwise', () => {
    expect(rotate(N, 1)).toBe(E)
    expect(rotate(E, 1)).toBe(S)
    expect(rotate(S, 1)).toBe(W)
    expect(rotate(W, 1)).toBe(N)
    expect(rotate(ELBOW, 1)).toBe(E | S)
  })

  it('returns to the start after four quarter-turns', () => {
    for (let mask = 0; mask < 16; mask++) {
      expect(rotate(mask, 4)).toBe(mask)
      expect(rotate(mask, -1)).toBe(rotate(mask, 3))
    }
  })

  it('gives a straight period 2 and a cross period 1, not a flat 4', () => {
    expect(rotationPeriod(CROSS)).toBe(1)
    expect(rotationPeriod(STRAIGHT)).toBe(2)
    expect(rotationPeriod(E | W)).toBe(2)
    expect(rotationPeriod(ELBOW)).toBe(4)
    expect(rotationPeriod(TEE)).toBe(4)
    expect(rotationPeriod(N)).toBe(4)
  })

  it('never charges more taps than a piece has distinct orientations', () => {
    for (let mask = 0; mask < 16; mask++) {
      const period = rotationPeriod(mask)
      for (let turns = 0; turns < 4; turns++) {
        expect(stepsBetween(rotate(mask, turns), mask)).toBeLessThan(period)
      }
    }
  })

  it('measures the shortest clockwise run between two orientations', () => {
    // The trap this guards: a straight is at most one tap from correct.
    expect(stepsBetween(rotate(STRAIGHT, 1), STRAIGHT)).toBe(1)
    expect(stepsBetween(STRAIGHT, STRAIGHT)).toBe(0)
    expect(stepsBetween(rotate(ELBOW, 3), ELBOW)).toBe(1)
    expect(stepsBetween(rotate(ELBOW, 1), ELBOW)).toBe(3)
    expect(stepsBetween(rotate(CROSS, 2), CROSS)).toBe(0)
  })

  it('names each piece shape from its mask', () => {
    expect(pieceKind(0)).toBe('blank')
    expect(pieceKind(N)).toBe('cap')
    expect(pieceKind(ELBOW)).toBe('elbow')
    expect(pieceKind(STRAIGHT)).toBe('straight')
    expect(pieceKind(TEE)).toBe('tee')
    expect(pieceKind(CROSS)).toBe('cross')
  })

  it('pairs every direction with its opposite', () => {
    expect(opposite(NORTH)).toBe(SOUTH)
    expect(opposite(EAST)).toBe(WEST)
    expect(opposite(opposite(NORTH))).toBe(NORTH)
  })
})

// ── Adjacency ─────────────────────────────────────────────────────────────────

describe('neighbourIndex', () => {
  const flat = { w: 4, h: 4, wrap: false }
  const torus = { w: 4, h: 4, wrap: true }

  it('runs off the edge of an unwrapped board', () => {
    expect(neighbourIndex(flat, 0, NORTH)).toBe(-1)
    expect(neighbourIndex(flat, 0, WEST)).toBe(-1)
    expect(neighbourIndex(flat, 0, EAST)).toBe(1)
    expect(neighbourIndex(flat, 0, SOUTH)).toBe(4)
    expect(neighbourIndex(flat, 15, SOUTH)).toBe(-1)
    expect(neighbourIndex(flat, 15, EAST)).toBe(-1)
  })

  it('wraps around both axes in torus mode', () => {
    expect(neighbourIndex(torus, 0, NORTH)).toBe(12)
    expect(neighbourIndex(torus, 0, WEST)).toBe(3)
    expect(neighbourIndex(torus, 15, SOUTH)).toBe(3)
    expect(neighbourIndex(torus, 15, EAST)).toBe(12)
  })

  it('is symmetric — stepping back returns to where you started', () => {
    for (const dims of [flat, torus]) {
      for (let i = 0; i < dims.w * dims.h; i++) {
        for (let d = 0; d < 4; d++) {
          const nb = neighbourIndex(dims, i, d)
          if (nb >= 0) expect(neighbourIndex(dims, nb, opposite(d))).toBe(i)
        }
      }
    }
  })

  it('never makes a cell its own neighbour on a one-wide wrapped grid', () => {
    const strip = { w: 1, h: 3, wrap: true }
    expect(neighbourIndex(strip, 0, EAST)).toBe(-1)
    expect(neighbourIndex(strip, 0, WEST)).toBe(-1)
    expect(neighbourIndex(strip, 0, SOUTH)).toBe(1)
  })
})

// ── Generation ────────────────────────────────────────────────────────────────

describe.each(WELLSPRING_DEPTHS.map(d => [d.id, d] as [string, DepthConfig]))(
  'generateBoard — %s',
  (id, depth) => {
    it('always produces a board whose generated arrangement is solved', () => {
      for (let s = 0; s < SEEDS; s++) {
        const board = generateBoard(depth, rngFor(`${id}:${s}`))
        const flow = computeFlow(atSolution(board))
        expect(flow.solved, `seed ${s}: solution does not solve`).toBe(true)
        expect(flow.leaks).toHaveLength(0)
        expect(flow.basinsFed).toBe(board.basinIndexes.length)
      }
    })

    it('never hands the player an already-solved board', () => {
      for (let s = 0; s < SEEDS; s++) {
        const board = generateBoard(depth, rngFor(`unsolved:${id}:${s}`))
        expect(board.par).toBeGreaterThan(0)
        expect(computeFlow(board).solved).toBe(false)
      }
    })

    it('lays out the grid, source and basins the depth asked for', () => {
      for (let s = 0; s < 40; s++) {
        const board = generateBoard(depth, rngFor(`shape:${id}:${s}`))
        expect(board.cells).toHaveLength(depth.w * depth.h)
        expect(board.w).toBe(depth.w)
        expect(board.wrap).toBe(depth.wrap)
        expect(board.cells[board.sourceIndex].role).toBe('source')
        expect(board.cells[board.sourceIndex].fixed).toBe(true)
        expect(board.basinIndexes).toHaveLength(depth.basins)
        expect(board.basinIndexes).not.toContain(board.sourceIndex)
        for (const i of board.basinIndexes) expect(board.cells[i].role).toBe('basin')
      }
    })

    it('welds and seizes exactly as many turnable cells as configured', () => {
      for (let s = 0; s < 40; s++) {
        const board = generateBoard(depth, rngFor(`marks:${id}:${s}`))
        // The source is fixed on top of the configured welds.
        const welded = board.cells.filter(c => c.fixed && c.role !== 'source')
        expect(welded).toHaveLength(depth.welded)
        expect(board.cells.filter(c => c.seized)).toHaveLength(depth.seized)
        // A welded or seized cross would be a mark the player can never see.
        for (const c of [...welded, ...board.cells.filter(x => x.seized)]) {
          expect(rotationPeriod(c.solution)).toBeGreaterThan(1)
        }
        for (const c of board.cells) {
          if (c.fixed) expect(c.mask).toBe(c.solution)
          if (c.seized) expect(c.fixed).toBe(false)
        }
      }
    })

    it('keeps every piece within the depth’s branching budget', () => {
      const cap = depth.treeStyle === 'path' ? 2 : 4
      for (let s = 0; s < 40; s++) {
        const board = generateBoard(depth, rngFor(`branch:${id}:${s}`))
        for (const cell of board.cells) {
          const open = [0, 1, 2, 3].filter(d => cell.solution & DIR_BIT[d]).length
          expect(open).toBeGreaterThan(0)
          expect(open).toBeLessThanOrEqual(cap)
        }
      }
    })
  },
)

describe('generateBoard — piece mix by tree style', () => {
  it('gives a path depth only caps, elbows and straights', () => {
    const depth = getDepth('shallow')
    for (let s = 0; s < 60; s++) {
      const board = generateBoard(depth, rngFor(`mix:path:${s}`))
      for (const cell of board.cells) {
        expect(['cap', 'elbow', 'straight']).toContain(pieceKind(cell.solution))
      }
    }
  })

  it('puts tees on a sparse depth and crosses on a dense one', () => {
    const kindsFor = (depthId: string, label: string) => {
      const found = new Set<string>()
      for (let s = 0; s < 60; s++) {
        for (const cell of generateBoard(getDepth(depthId), rngFor(`${label}:${s}`)).cells) {
          found.add(pieceKind(cell.solution))
        }
      }
      return found
    }
    expect(kindsFor('deep', 'mix:sparse')).toContain('tee')
    expect(kindsFor('vault', 'mix:dense')).toContain('cross')
  })
})

// ── Par ───────────────────────────────────────────────────────────────────────

describe('par', () => {
  it.each(WELLSPRING_DEPTHS.map(d => [d.id, d] as [string, DepthConfig]))(
    'is exactly the taps it takes to turn every piece right — %s',
    (id, depth) => {
      for (let s = 0; s < SEEDS; s++) {
        const board = generateBoard(depth, rngFor(`par:${id}:${s}`))
        // Play the board honestly: turn each cell clockwise until it is right,
        // charging the seized double rate, and count the taps.
        let working = board
        let spent = 0
        for (let i = 0; i < working.cells.length; i++) {
          while (isRotatable(working.cells[i]) && working.cells[i].mask !== working.cells[i].solution) {
            spent += moveCost(working.cells[i])
            working = rotateCellAt(working, i)
          }
        }
        expect(spent, `seed ${s}`).toBe(board.par)
        expect(computeFlow(working).solved).toBe(true)
      }
    },
  )

  it('charges a straight one tap, not three', () => {
    // Whole-board proof of the symmetry rule: a path depth is straights,
    // elbows and caps only, so par can never reach 3 taps per turnable cell.
    const depth = getDepth('shallow')
    for (let s = 0; s < 60; s++) {
      const board = generateBoard(depth, rngFor(`straights:${s}`))
      const straights = board.cells.filter(c => isRotatable(c) && pieceKind(c.solution) === 'straight')
      for (const cell of straights) {
        expect(stepsBetween(cell.mask, cell.solution)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('costs a seized piece double', () => {
    const depth = getDepth('vault')
    for (let s = 0; s < 30; s++) {
      const board = generateBoard(depth, rngFor(`seized:${s}`))
      const plain = board.cells
        .filter(c => !c.fixed && !c.seized)
        .reduce((n, c) => n + stepsBetween(c.mask, c.solution), 0)
      const seized = board.cells
        .filter(c => c.seized)
        .reduce((n, c) => n + stepsBetween(c.mask, c.solution), 0)
      expect(board.par).toBe(plain + seized * 2)
    }
  })
})

// ── Flow ──────────────────────────────────────────────────────────────────────

describe('computeFlow', () => {
  it('reads only the board in front of it, never the stored solution', () => {
    // The load-bearing property: an arrangement that works is accepted on its
    // own merits, which is what lets a player finish under par.
    const board = atSolution(generateBoard(getDepth('deep'), rngFor('independence')))
    const scrubbed: Board = { ...board, cells: board.cells.map(c => ({ ...c, solution: 0 })) }
    expect(computeFlow(scrubbed).solved).toBe(true)
  })

  it('reports an unfed cell and a spilling end the moment one piece turns', () => {
    const solved = atSolution(generateBoard(getDepth('deep'), rngFor('break')))
    const victim = solved.cells.findIndex(c => isRotatable(c))
    const broken = rotateCellAt(solved, victim)
    const flow = computeFlow(broken)
    expect(flow.solved).toBe(false)
    expect(flow.leaks.length).toBeGreaterThan(0)
    // Every leak names a cell that has water and an open side to spill from.
    for (const leak of flow.leaks) {
      expect(flow.filled[leak.index]).toBe(true)
      expect(broken.cells[leak.index].mask & DIR_BIT[leak.dir]).toBeTruthy()
    }
  })

  it('counts an end pointing off an unwrapped board as a leak', () => {
    const board = atSolution(generateBoard(getDepth('shallow'), rngFor('edge')))
    // Point the source at the outside world; it has water, so it must spill.
    const cells = board.cells.slice()
    cells[board.sourceIndex] = { ...cells[board.sourceIndex], mask: 0b1111 }
    const flow = computeFlow({ ...board, cells })
    expect(flow.solved).toBe(false)
    expect(flow.leaks.some(l => l.index === board.sourceIndex)).toBe(true)
  })

  it('lets a wrapped board run off one edge and back in the other', () => {
    // Torus depth: pieces legitimately point past the frame, so a solved vault
    // board must still report zero leaks.
    for (let s = 0; s < 60; s++) {
      const board = atSolution(generateBoard(getDepth('vault'), rngFor(`torus:${s}`)))
      expect(computeFlow(board).leaks).toHaveLength(0)
    }
  })

  it('fills basins as they connect', () => {
    const board = generateBoard(getDepth('vault'), rngFor('basins'))
    expect(computeFlow(board).basinsFed).toBeLessThanOrEqual(board.basinIndexes.length)
    expect(computeFlow(atSolution(board)).basinsFed).toBe(board.basinIndexes.length)
  })
})

// ── Player actions ────────────────────────────────────────────────────────────

describe('rotateCellAt', () => {
  it('leaves the original board untouched', () => {
    const board = generateBoard(getDepth('deep'), rngFor('immutable'))
    const index = board.cells.findIndex(c => isRotatable(c))
    const before = board.cells[index].mask
    const next = rotateCellAt(board, index)
    expect(board.cells[index].mask).toBe(before)
    expect(next.cells[index].mask).toBe(rotate(before, 1))
    expect(next).not.toBe(board)
  })

  it('refuses fixed cells, crosses and indexes off the board', () => {
    const board = generateBoard(getDepth('shallow'), rngFor('refuse'))
    expect(rotateCellAt(board, board.sourceIndex)).toBe(board)
    expect(rotateCellAt(board, -1)).toBe(board)
    expect(rotateCellAt(board, 999)).toBe(board)

    const cells = board.cells.slice()
    cells[1] = { ...cells[1], fixed: false, solution: CROSS, mask: CROSS }
    const withCross = { ...board, cells }
    expect(isRotatable(withCross.cells[1])).toBe(false)
    expect(rotateCellAt(withCross, 1)).toBe(withCross)
  })
})

describe('dowse', () => {
  it('snaps one wrong cell right and leaves the rest alone', () => {
    const board = generateBoard(getDepth('deep'), rngFor('dowse'))
    const result = dowse(board, rngFor('dowse-pick'))
    expect(result).not.toBeNull()
    const { board: next, index } = result!
    expect(next.cells[index].mask).toBe(next.cells[index].solution)
    for (let i = 0; i < board.cells.length; i++) {
      if (i !== index) expect(next.cells[i].mask).toBe(board.cells[i].mask)
    }
  })

  it('has nothing to offer once every piece already sits right', () => {
    expect(dowse(atSolution(generateBoard(getDepth('deep'), rngFor('dowse-done'))))).toBeNull()
  })

  it('always finishes a board when leant on repeatedly', () => {
    let board = generateBoard(getDepth('vault'), rngFor('dowse-all'))
    for (let guard = 0; guard < 200; guard++) {
      const step = dowse(board, rngFor(`dowse-all:${guard}`))
      if (!step) break
      board = step.board
    }
    expect(computeFlow(board).solved).toBe(true)
  })
})

// ── Scoring ───────────────────────────────────────────────────────────────────

describe('scoreRun', () => {
  const depth = getDepth('deep')

  it('pays the full base for a solve exactly on par', () => {
    const score = scoreRun(depth, 20, 20)
    expect(score.efficiency).toBe(1)
    expect(score.underPar).toBe(false)
    expect(score.crystals).toBe(depth.crystalBase)
  })

  it('adds the bonus for finishing under par', () => {
    const score = scoreRun(depth, 20, 16)
    expect(score.underPar).toBe(true)
    expect(score.efficiency).toBe(1)
    expect(score.crystals).toBe(depth.crystalBase + WELLSPRING_SCORING.underParCrystals)
  })

  it('never pays less than the floor, however sloppy the solve', () => {
    const score = scoreRun(depth, 20, 10_000)
    expect(score.efficiency).toBe(WELLSPRING_SCORING.efficiencyFloor)
    expect(score.crystals).toBe(Math.round(depth.crystalBase * WELLSPRING_SCORING.efficiencyFloor))
    expect(score.crystals).toBeGreaterThan(0)
  })

  it('scales between the floor and the base as moves drift past par', () => {
    const tight = scoreRun(depth, 20, 25).crystals
    const loose = scoreRun(depth, 20, 50).crystals
    expect(tight).toBeGreaterThan(loose)
    expect(tight).toBeLessThan(depth.crystalBase)
  })
})

describe('depth configuration', () => {
  it('escalates grid, reward and difficulty across the three depths', () => {
    const [shallow, deep, vault] = WELLSPRING_DEPTHS
    expect(WELLSPRING_DEPTHS).toHaveLength(3)
    expect(shallow.w).toBeLessThan(deep.w)
    expect(deep.w).toBeLessThan(vault.w)
    expect(shallow.crystalBase).toBeLessThan(deep.crystalBase)
    expect(deep.crystalBase).toBeLessThan(vault.crystalBase)
    expect(shallow.wrap).toBe(false)
    expect(vault.wrap).toBe(true)
  })

  it('falls back to the shallowest depth for an unknown id', () => {
    expect(getDepth('no-such-depth').id).toBe(WELLSPRING_DEPTHS[0].id)
    expect(getDepth('vault').id).toBe('vault')
  })
})
