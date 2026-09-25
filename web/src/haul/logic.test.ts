import { describe, it, expect } from 'vitest'
import { DX, DY, LAYOUTS, MAZES, exits, houseFor, parseMaze, walkable } from './maze'
import {
  BAG, CANDY_PER_DOOR, EXTRA_LIFE_EVERY, LANTERN_TIME, LIVES, PLAYER_SPEED, READY_TIME, STREETS, TIME_BONUS,
  bankPoints, createWorld, doorsLeft, huntTarget, lanternTime, playerSpeed, step, steer, streetDef, walk,
  type Ghoul, type World,
} from './world'

const DT = 1 / 60

function run(w: World, seconds: number) {
  const events: string[] = []
  for (let i = 0; i < Math.round(seconds * 60); i++) events.push(...step(w, DT).map(e => e.kind))
  return events
}

/** A street in play with every ghoul kept in the graveyard. */
function quiet(hero: World['hero'] = 'witch'): World {
  const w = createWorld(1, hero)
  for (const g of w.ghouls) g.release = 1e9
  w.phase = 'play'
  return w
}

const put = (w: World, x: number, y: number) => Object.assign(w.player, { x, y, dir: null, want: null })

describe('mazes', () => {
  it.each(LAYOUTS.map((rows, i) => [i, rows] as const))('layout %i is sound', (_i, rows) => {
    const m = parseMaze(rows)
    expect(rows.every(r => r.length === m.cols)).toBe(true)
    expect(m.home).toBeDefined()
    expect(houseFor(m, m.home)).not.toBeNull()
    expect(walkable(m, m.gate.x, m.gate.y)).toBe(true)
    expect(m.lanterns.length).toBe(4)
    for (const d of m.doors) expect(houseFor(m, d), `door ${d.x},${d.y}`).not.toBeNull()

    // Every bit of pavement is reachable from home, and none is a dead end
    // (ghouls never turn back, so a dead end would trap them).
    const key = (x: number, y: number) => `${(x + m.cols) % m.cols},${y}`
    const seen = new Set([key(m.home.x, m.home.y)])
    const todo = [m.home]
    while (todo.length) {
      const c = todo.pop()!
      for (const d of exits(m, c.x, c.y)) {
        const n = { x: (c.x + DX[d] + m.cols) % m.cols, y: c.y + DY[d] }
        if (!seen.has(key(n.x, n.y))) { seen.add(key(n.x, n.y)); todo.push(n) }
      }
    }
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        if (!walkable(m, x, y)) continue
        expect(seen.has(key(x, y)), `unreachable ${x},${y}`).toBe(true)
        expect(exits(m, x, y).length, `dead end ${x},${y}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('every street uses a real layout, and the list loops', () => {
    for (const s of STREETS) expect(MAZES[s.layout]).toBeDefined()
    expect(streetDef(STREETS.length + 1)).toBe(STREETS[0])
  })
})

describe('walking', () => {
  it('waits at home until told where to go, then goes', () => {
    const w = quiet()
    const home = { ...w.maze.home }
    run(w, 0.5)
    expect(w.player).toMatchObject(home)
    steer(w, 'left')
    run(w, 0.2)
    expect(w.player.x).toBeCloseTo(home.x - PLAYER_SPEED * 0.2, 1)
  })

  it('remembers a turn and takes it at the next corner', () => {
    const w = quiet()
    const m = w.maze
    // Pumpkin Lane: walk left from home along row 15; col 4 is the first
    // corner with a way up.
    put(w, 7, 15)
    steer(w, 'left')
    run(w, 0.1)
    steer(w, 'up')
    run(w, 1)
    expect(walkable(m, 4, 14)).toBe(true)
    expect(Math.round(w.player.x)).toBe(4)
    expect(w.player.y).toBeLessThan(15)
  })

  it('turns back at once, without needing a corner', () => {
    const w = quiet()
    put(w, 7, 15)
    steer(w, 'left')
    run(w, 0.15)
    const x = w.player.x
    steer(w, 'right')
    run(w, 0.1)
    expect(w.player.x).toBeGreaterThan(x)
  })

  it('stops against a house', () => {
    const w = quiet()
    put(w, 8, 1) // top row, fence at col 9
    steer(w, 'right')
    run(w, 1)
    expect(w.player.x).toBe(8)
    expect(w.player.dir).toBeNull()
  })

  it('wraps through the side alleys', () => {
    const w = quiet()
    put(w, 1, 9)
    steer(w, 'left')
    run(w, 0.6)
    expect(w.player.x).toBeGreaterThan(w.maze.cols - 3)
    expect(w.player.y).toBe(9)
  })

  it('never leaves the pavement', () => {
    const w = createWorld(7)
    w.phase = 'play'
    const dirs = ['up', 'left', 'down', 'right'] as const
    for (let i = 0; i < 60 * 30; i++) {
      if (i % 20 === 0) steer(w, dirs[(i * 7) % 4])
      step(w, DT)
      if (w.phase !== 'play') { w.phase = 'play'; for (const g of w.ghouls) g.mode = 'pen' }
      const { x, y } = w.player
      expect(walkable(w.maze, Math.round(x), Math.round(y))).toBe(true)
      expect(Number.isInteger(x) || Number.isInteger(y)).toBe(true)
    }
  })

  it('walk moves exactly the distance asked for, through corners', () => {
    const m = MAZES[0]
    const a = { x: 7, y: 15, dir: null as null | 'left' }
    walk(m, a, 2.5, () => 'left')
    expect(a.x).toBeCloseTo(4.5)
  })
})

describe('sweets', () => {
  it('knocking on a lit door fills the bag and puts the light out', () => {
    const w = quiet()
    const d = w.maze.doors[0]
    put(w, d.x, d.y)
    const events = run(w, DT)
    expect(events).toContain('knock')
    expect(w.bag).toBe(CANDY_PER_DOOR)
    expect(w.lit[0]).toBe(false)
    expect(doorsLeft(w)).toBe(w.maze.doors.length - 1)
    expect(run(w, DT)).not.toContain('knock')
  })

  it('a full bag cannot take more, and says so once', () => {
    const w = quiet()
    w.bag = BAG
    const d = w.maze.doors[0]
    put(w, d.x, d.y)
    const events = run(w, 0.5)
    expect(events.filter(e => e === 'full')).toHaveLength(1)
    expect(w.lit[0]).toBe(true)
    expect(w.bag).toBe(BAG)
  })

  it('banking at home scores 10 × sweets², so a fuller bag pays more', () => {
    expect(bankPoints(10)).toBe(1000)
    expect(bankPoints(2) * 5).toBeLessThan(bankPoints(10))
    const w = quiet()
    w.bag = 6
    const events = run(w, DT)
    expect(events).toContain('bank')
    expect(w.score).toBe(360)
    expect(w.bag).toBe(0)
    expect(w.haul).toBe(6)
  })

  it('the salaryman banks at double after midnight, and only then', () => {
    const w = quiet('salaryman')
    w.bag = 4
    run(w, DT)
    expect(w.score).toBe(160)
    w.midnight = true
    w.bag = 4
    run(w, DT)
    expect(w.score).toBe(160 + 320)
  })

  it('the witch keeps a lantern lit twice as long; the hero runs faster', () => {
    expect(lanternTime(createWorld(1, 'witch'))).toBe(LANTERN_TIME * 2)
    expect(lanternTime(createWorld(1, 'salaryman'))).toBe(LANTERN_TIME)
    expect(playerSpeed(createWorld(1, 'hero'))).toBeGreaterThan(playerSpeed(createWorld(1, 'witch')))
  })

  it('an extra life every 10,000', () => {
    const w = quiet()
    w.score = EXTRA_LIFE_EVERY - 100
    w.bag = 10
    expect(run(w, DT)).toContain('extra')
    expect(w.lives).toBe(LIVES + 1)
  })
})

describe('the street', () => {
  it('starts with a READY pause, then the clock runs', () => {
    const w = createWorld(1)
    run(w, READY_TIME - 0.1)
    expect(w.phase).toBe('ready')
    expect(w.clock).toBe(w.def.time)
    run(w, 1)
    expect(w.phase).toBe('play')
    expect(w.clock).toBeLessThan(w.def.time)
  })

  it('the midnight bell tolls once, and the ghouls speed up', () => {
    const w = quiet()
    w.clock = 0.05
    expect(run(w, 0.5).filter(e => e === 'midnight')).toHaveLength(1)
    expect(w.midnight).toBe(true)
  })

  it('clears when every door is dark and the bag is banked, with a time bonus', () => {
    const w = quiet()
    w.lit = w.lit.map(() => false)
    w.bag = 2
    w.clock = 40.5
    const events = run(w, DT)
    expect(events).toContain('cleared')
    expect(w.tally.points).toBe(41 * TIME_BONUS)
    expect(w.phase).toBe('cleared')
  })

  it('no time bonus after midnight', () => {
    const w = quiet()
    w.lit = w.lit.map(() => false)
    w.midnight = true
    w.clock = 0
    run(w, DT)
    expect(w.phase).toBe('cleared')
    expect(w.tally.points).toBe(0)
  })
})

describe('ghouls', () => {
  const ghoul = (w: World, kind: Ghoul['kind']) => w.ghouls.find(g => g.kind === kind)!

  it('climb out of the graveyard one at a time', () => {
    const w = createWorld(1)
    w.phase = 'play'
    const out: string[] = []
    for (let i = 0; i < 60 * 14; i++) {
      step(w, DT)
      for (const g of w.ghouls) {
        if (g.mode !== 'hunt') continue
        if (!out.includes(g.kind)) out.push(g.kind)
        Object.assign(g, { ...w.maze.gate, dir: null }) // hold it far from home
      }
      if (i === 60 * 2) expect(out).toHaveLength(1)
    }
    expect(out).toEqual(w.ghouls.map(g => g.kind))
  })

  it('catching you spills the bag and costs a life', () => {
    const w = quiet()
    put(w, 7, 15)
    w.bag = 8
    const g = w.ghouls[0]
    Object.assign(g, { mode: 'hunt', x: w.player.x + 0.5, y: w.player.y })
    const events = run(w, DT)
    expect(events).toEqual(expect.arrayContaining(['caught', 'spill']))
    expect(w.bag).toBe(0)
    run(w, 2)
    expect(w.lives).toBe(LIVES - 1)
    expect(w.phase).toBe('ready')
    expect(w.player).toMatchObject(w.maze.home)
  })

  it('the last life ends the game', () => {
    const w = quiet()
    w.lives = 1
    Object.assign(w.ghouls[0], { mode: 'hunt', x: w.player.x, y: w.player.y })
    expect(run(w, 2)).toContain('over')
    expect(w.phase).toBe('over')
  })

  it('a lantern turns them, and each one scared off in a row scores double', () => {
    const w = quiet()
    for (const g of w.ghouls) g.mode = 'hunt'
    const l = w.maze.lanterns[0]
    put(w, l.x, l.y)
    expect(run(w, DT)).toContain('lantern')
    expect(w.ghouls.every(g => g.scared)).toBe(true)
    const points: number[] = []
    for (const g of w.ghouls) {
      Object.assign(g, { x: w.player.x, y: w.player.y })
      const before = w.score
      run(w, DT)
      points.push(w.score - before)
      expect(g.mode).toBe('eyes')
    }
    expect(points).toEqual([200, 400, 800])
  })

  it('eaten ghouls go home and come back out', () => {
    const w = quiet()
    const g = w.ghouls[0]
    Object.assign(g, { mode: 'eyes', x: 4, y: 13, dir: null, release: 0 })
    for (let i = 0; i < 60 * 3 && g.mode === 'eyes'; i++) step(w, DT)
    expect(g.mode).toBe('pen')
    expect(g).toMatchObject(g.slot)
    g.release = 0.1
    run(w, 0.2)
    expect(g.mode).toBe('hunt')
  })

  it('the lantern wears off', () => {
    const w = quiet('salaryman')
    for (const g of w.ghouls) g.mode = 'hunt'
    const l = w.maze.lanterns[0]
    put(w, l.x, l.y)
    const events = run(w, LANTERN_TIME + 0.1)
    expect(events).toContain('lanternEnd')
    expect(w.ghouls.some(g => g.scared)).toBe(false)
  })

  it('the bat heads for where you are going; the zombie waits at your door when the bag is heavy', () => {
    const w = quiet()
    put(w, 7, 15)
    w.player.dir = 'left'
    expect(huntTarget(w, ghoul(w, 'bat'))).toEqual({ x: 3, y: 15 })
    expect(huntTarget(w, ghoul(w, 'zombie'))).toEqual({ x: 7, y: 15 })
    w.bag = 6
    expect(huntTarget(w, ghoul(w, 'zombie'))).toEqual(w.maze.home)
  })

  it('the ghost drifts through houses', () => {
    const w = quiet()
    const g = ghoul(w, 'ghost')
    Object.assign(g, { mode: 'hunt', x: 9, y: 3 })
    put(w, 9, 13)
    run(w, 1)
    expect(g.x).toBeCloseTo(9)
    expect(g.y).toBeGreaterThan(4)
  })

  it('walking ghouls stay on the pavement, and sooner or later catch someone standing still', () => {
    const w = createWorld(3)
    w.phase = 'play'
    let caught = false
    for (let i = 0; i < 60 * 60 && !caught; i++) {
      caught = step(w, DT).some(e => e.kind === 'caught')
      for (const g of w.ghouls) {
        if (g.mode === 'pen' || g.kind === 'ghost') continue
        expect(walkable(w.maze, Math.round(g.x), Math.round(g.y))).toBe(true)
      }
    }
    expect(caught).toBe(true)
  })
})
