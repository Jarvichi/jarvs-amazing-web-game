// ─── /haul: the rules ───────────────────────────────────────────────────────
//
// MIDNIGHT HAUL. Knock on every lit door in the street for sweets, carry them
// home in a bag that holds ten, and bank them before a ghoul catches you and
// your bag spills. A bigger bag banks for more (10 × sweets²), so how long to
// push your luck is the game. Jack-o'-lanterns turn the ghouls for a while.
// The midnight bell makes them faster; clear the street before it tolls for
// a time bonus.
//
// Pure: no drawing, no sound — `step` returns events for main.ts. Positions
// are in tiles (floats); a walker at a whole number is on a cell's centre.

import {
  DX, DY, MAZES, OPPOSITE, exits, walkable,
  type Cell, type Dir, type Maze,
} from './maze'

export type Hero = 'witch' | 'hero' | 'salaryman'
export type GhoulKind = 'bat' | 'zombie' | 'skeleton' | 'ghost'

export const HEROES: Hero[] = ['witch', 'hero', 'salaryman']

export const BAG = 10
export const CANDY_PER_DOOR = 2
export const KNOCK_POINTS = 10
export const LIVES = 3
export const EXTRA_LIFE_EVERY = 10000
export const READY_TIME = 2
export const CAUGHT_TIME = 1.6
export const CLEARED_TIME = 3.5
export const TIME_BONUS = 10

/** Tiles per second. */
export const PLAYER_SPEED = 5
export const HERO_SPEED = 1.15
export const SPEED: Record<GhoulKind, number> = { bat: 4.6, skeleton: 4.4, zombie: 3.4, ghost: 2.3 }
export const SCARED_SPEED = 2.5
export const EYES_SPEED = 9
export const MIDNIGHT_SPEED = 1.2
export const LANTERN_TIME = 6
/** The zombie smells a bag this full and waits by your door. */
export const ZOMBIE_NOSE = 6

export const bankPoints = (candy: number) => 10 * candy * candy

export interface StreetDef {
  name: string
  layout: number
  ghouls: GhoulKind[]
  /** Seconds until the midnight bell. */
  time: number
  fog: boolean
}

export const STREETS: StreetDef[] = [
  { name: 'PUMPKIN LANE', layout: 0, ghouls: ['bat', 'zombie', 'ghost'], time: 100, fog: false },
  { name: 'GRAVEYARD ROW', layout: 1, ghouls: ['bat', 'zombie', 'skeleton', 'ghost'], time: 95, fog: false },
  { name: 'FOGGY HOLLOW', layout: 0, ghouls: ['bat', 'zombie', 'skeleton', 'ghost'], time: 95, fog: true },
  { name: 'WITCHWOOD', layout: 2, ghouls: ['bat', 'zombie', 'skeleton', 'ghost'], time: 90, fog: false },
  { name: 'HILL HOUSE', layout: 1, ghouls: ['bat', 'zombie', 'skeleton', 'ghost'], time: 90, fog: true },
]

export const streetDef = (n: number): StreetDef => STREETS[(n - 1) % STREETS.length]
/** Ghouls get faster street by street, then level off. */
export const streetSpeed = (n: number) => Math.min(1.4, 1 + (n - 1) * 0.05)
/** Seconds after the street starts that each ghoul climbs out, in list order. */
export const RELEASE = [1.5, 5, 9, 13]

export type Rng = () => number
export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0x100000000
  }
}

export interface Walker { x: number; y: number; dir: Dir | null }

export interface Player extends Walker {
  /** The direction asked for; taken at the next corner it fits. */
  want: Dir | null
  /** Last direction moved, for facing. */
  face: Dir
}

export interface Ghoul extends Walker {
  kind: GhoulKind
  mode: 'pen' | 'hunt' | 'eyes'
  /** Seconds left in the graveyard. */
  release: number
  slot: Cell
  scared: boolean
  /** Bat: seconds left flitting at random, and until the next flit. */
  flit: number
  flitIn: number
}

export type Phase = 'ready' | 'play' | 'caught' | 'cleared' | 'over'

export interface World {
  rng: Rng
  hero: Hero
  street: number
  def: StreetDef
  maze: Maze
  player: Player
  ghouls: Ghoul[]
  /** One per maze door: still has sweets to give. */
  lit: boolean[]
  lanterns: boolean[]
  bag: number
  score: number
  lives: number
  nextLife: number
  /** Seconds until midnight. */
  clock: number
  midnight: boolean
  /** Seconds the lantern has left, and ghouls eaten during it. */
  lantern: number
  chain: number
  phase: Phase
  phaseTime: number
  tally: { time: number; points: number }
  /** Sweets banked across the whole game. */
  haul: number
  /** The lit door a full bag is standing at (-1: none). */
  fullAt: number
}

export type EventKind =
  | 'ready' | 'knock' | 'full' | 'bank' | 'lantern' | 'lanternEnd' | 'eat'
  | 'caught' | 'spill' | 'midnight' | 'cleared' | 'extra' | 'over'

export interface GameEvent { kind: EventKind; points?: number; x?: number; y?: number }

export function createWorld(seed: number, hero: Hero = 'witch', street = 1): World {
  const w = {
    rng: makeRng(seed), hero, street: 0, fullAt: -1, score: 0, lives: LIVES, nextLife: EXTRA_LIFE_EVERY, haul: 0,
  } as World
  startStreet(w, street)
  return w
}

export function startStreet(w: World, n: number): GameEvent[] {
  w.street = n
  w.def = streetDef(n)
  w.maze = MAZES[w.def.layout]
  w.lit = w.maze.doors.map(() => true)
  w.lanterns = w.maze.lanterns.map(() => true)
  w.bag = 0
  w.clock = w.def.time
  w.midnight = false
  w.tally = { time: 0, points: 0 }
  w.ghouls = w.def.ghouls.map((kind, i) => ({
    kind, mode: 'pen', release: 0, slot: w.maze.pen[i % w.maze.pen.length],
    x: 0, y: 0, dir: null, scared: false, flit: 0, flitIn: 3 + i,
  }))
  resetPositions(w)
  return [{ kind: 'ready' }]
}

/** Start of a street, and after being caught: you at home, ghouls in the graveyard. */
function resetPositions(w: World) {
  const h = w.maze.home
  w.player = { x: h.x, y: h.y, dir: null, want: null, face: 'left' }
  w.ghouls.forEach((g, i) => {
    g.mode = 'pen'
    g.release = RELEASE[i] ?? RELEASE[RELEASE.length - 1] + i * 4
    g.x = g.slot.x
    g.y = g.slot.y
    g.dir = null
    g.scared = false
  })
  w.lantern = 0
  w.chain = 0
  w.phase = 'ready'
  w.phaseTime = 0
}

export const doorsLeft = (w: World) => w.lit.filter(Boolean).length
export const lanternTime = (w: World) => LANTERN_TIME * (w.hero === 'witch' ? 2 : 1) * (w.street > STREETS.length ? 0.7 : 1)
export const playerSpeed = (w: World) => PLAYER_SPEED * (w.hero === 'hero' ? HERO_SPEED : 1)
/** The salaryman's overtime: after midnight he banks at double. */
export const bankRate = (w: World) => (w.hero === 'salaryman' && w.midnight ? 2 : 1)

export function ghoulSpeed(w: World, g: Ghoul): number {
  if (g.mode === 'eyes') return EYES_SPEED
  if (g.scared) return SCARED_SPEED
  return SPEED[g.kind] * streetSpeed(w.street) * (w.midnight ? MIDNIGHT_SPEED : 1)
}

// ── Movement ────────────────────────────────────────────────────────────────

const wrapX = (m: Maze, x: number) => (x < -0.5 ? x + m.cols : x > m.cols - 0.5 ? x - m.cols : x)
const EPS = 1e-6

/**
 * Move a walker up to `dist` tiles along the grid. At each cell centre it
 * passes, `choose` picks the way on (null stops it there).
 */
export function walk(m: Maze, a: Walker, dist: number, choose: (cx: number, cy: number) => Dir | null): void {
  for (let guard = 0; dist > EPS && guard < 16; guard++) {
    const cx = Math.round(a.x)
    const cy = Math.round(a.y)
    const atCentre = Math.abs(a.x - cx) < EPS && Math.abs(a.y - cy) < EPS
    if (atCentre) {
      a.x = cx
      a.y = cy
      a.dir = choose(cx, cy)
    }
    if (!a.dir) return
    const horiz = a.dir === 'left' || a.dir === 'right'
    const along = horiz ? a.x : a.y
    const sign = DX[a.dir] + DY[a.dir]
    const target = atCentre ? along + sign : sign > 0 ? Math.ceil(along) : Math.floor(along)
    const s = Math.min(Math.abs(target - along), dist)
    if (horiz) a.x = wrapX(m, a.x + sign * s)
    else a.y += sign * s
    dist -= s
  }
}

/**
 * How far past a corner (in tiles) a swipe can come and still take it. A
 * turn at full speed lasts three frames at the centre, which a thumb misses.
 */
export const CORNER_GRACE = 0.45

/** A turn asked for just after passing a corner steps back and takes it. */
function lateTurn(m: Maze, p: Player) {
  if (!p.want || !p.dir || p.want === p.dir || p.want === OPPOSITE[p.dir]) return
  const horiz = p.dir === 'left' || p.dir === 'right'
  const along = horiz ? p.x : p.y
  const behind = DX[p.dir] + DY[p.dir] > 0 ? Math.floor(along) : Math.ceil(along)
  if (Math.abs(along - behind) > CORNER_GRACE) return
  const cx = horiz ? behind : p.x
  const cy = horiz ? p.y : behind
  if (!walkable(m, cx + DX[p.want], cy + DY[p.want])) return
  p.x = cx
  p.y = cy
  p.dir = p.want
}

function movePlayer(w: World, dt: number) {
  const p = w.player
  const m = w.maze
  // Turning back needs no corner.
  if (p.want && p.dir && p.want === OPPOSITE[p.dir]) p.dir = p.want
  lateTurn(m, p)
  walk(m, p, playerSpeed(w) * dt, (cx, cy) => {
    if (p.want && walkable(m, cx + DX[p.want], cy + DY[p.want])) return p.want
    if (p.dir && walkable(m, cx + DX[p.dir], cy + DY[p.dir])) return p.dir
    return null
  })
  if (p.dir) p.face = p.dir
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2

/** Where each ghoul is heading while it hunts. */
export function huntTarget(w: World, g: Ghoul): Cell {
  const p = w.player
  switch (g.kind) {
    case 'bat': {
      const d = p.dir ?? p.face
      return { x: p.x + DX[d] * 4, y: p.y + DY[d] * 4 }
    }
    case 'zombie':
      return w.bag >= ZOMBIE_NOSE ? w.maze.home : { x: p.x, y: p.y }
    default:
      return { x: p.x, y: p.y }
  }
}

function chooseGhoulDir(w: World, g: Ghoul, cx: number, cy: number): Dir | null {
  const m = w.maze
  // Eyes stop on the gate, so they can't overshoot it between frames.
  if (g.mode === 'eyes' && cx === m.gate.x && cy === m.gate.y) return null
  let options = exits(m, cx, cy)
  if (g.dir && options.length > 1) options = options.filter(d => d !== OPPOSITE[g.dir!])
  if (options.length === 0) return null
  if (options.length === 1) return options[0]
  if (g.mode === 'hunt' && (g.flit > 0 || (g.scared && w.rng() < 0.25))) {
    return options[Math.floor(w.rng() * options.length)]
  }
  const t = g.mode === 'eyes' ? m.gate : huntTarget(w, g)
  const away = g.mode === 'hunt' && g.scared
  let best = options[0]
  let bestD = away ? -Infinity : Infinity
  for (const d of options) {
    const dd = dist2(cx + DX[d], cy + DY[d], t.x, t.y)
    if (away ? dd > bestD : dd < bestD) { best = d; bestD = dd }
  }
  return best
}

/** The ghost drifts straight through houses, slowly. */
function driftGhost(w: World, g: Ghoul, dt: number) {
  const m = w.maze
  const t = g.mode === 'eyes' ? m.gate : { x: w.player.x, y: w.player.y }
  let vx = t.x - g.x
  let vy = t.y - g.y
  if (g.mode === 'hunt' && g.scared) { vx = -vx; vy = -vy }
  const len = Math.hypot(vx, vy)
  if (len < EPS) return
  const s = Math.min(len, ghoulSpeed(w, g) * dt)
  g.x = Math.max(1, Math.min(m.cols - 2, g.x + (vx / len) * s))
  g.y = Math.max(1, Math.min(m.rows - 2, g.y + (vy / len) * s))
  g.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down'
}

function moveGhoul(w: World, g: Ghoul, dt: number) {
  const m = w.maze
  if (g.mode === 'pen') {
    g.release -= dt
    if (g.release <= 0) {
      g.mode = 'hunt'
      g.x = m.gate.x
      g.y = m.gate.y
      g.dir = null
      g.scared = false
    }
    return
  }
  if (g.kind === 'bat' && g.mode === 'hunt') {
    g.flit -= dt
    g.flitIn -= dt
    if (g.flitIn <= 0) { g.flit = 1; g.flitIn = 4 + w.rng() * 2 }
  }
  if (g.kind === 'ghost') driftGhost(w, g, dt)
  else walk(m, g, ghoulSpeed(w, g) * dt, (cx, cy) => chooseGhoulDir(w, g, cx, cy))
  if (g.mode === 'eyes' && dist2(g.x, g.y, m.gate.x, m.gate.y) < 0.01) {
    g.mode = 'pen'
    g.release = 1.5
    g.x = g.slot.x
    g.y = g.slot.y
  }
}

// ── The street ──────────────────────────────────────────────────────────────

const onCell = (a: Walker, c: Cell) => Math.abs(a.x - c.x) < 0.3 && Math.abs(a.y - c.y) < 0.3

function addScore(w: World, points: number, events: GameEvent[]) {
  w.score += points
  while (w.score >= w.nextLife) {
    w.lives++
    w.nextLife += EXTRA_LIFE_EVERY
    events.push({ kind: 'extra' })
  }
}

function doorstep(w: World, events: GameEvent[]) {
  const p = w.player
  const m = w.maze
  let fullAt = -1
  m.doors.forEach((d, i) => {
    if (!w.lit[i] || !onCell(p, d)) return
    if (w.bag + CANDY_PER_DOOR > BAG) {
      // Complain once per visit, not every frame spent on the step.
      if (w.fullAt !== i) events.push({ kind: 'full', x: d.x, y: d.y })
      fullAt = i
      return
    }
    w.lit[i] = false
    w.bag += CANDY_PER_DOOR
    addScore(w, KNOCK_POINTS, events)
    events.push({ kind: 'knock', x: d.x, y: d.y, points: KNOCK_POINTS })
  })
  w.fullAt = fullAt
  m.lanterns.forEach((l, i) => {
    if (!w.lanterns[i] || !onCell(p, l)) return
    w.lanterns[i] = false
    w.lantern = lanternTime(w)
    w.chain = 0
    for (const g of w.ghouls) {
      if (g.mode !== 'hunt') continue
      g.scared = true
      if (g.dir && g.kind !== 'ghost') g.dir = OPPOSITE[g.dir]
    }
    events.push({ kind: 'lantern', x: l.x, y: l.y })
  })
  if (w.bag > 0 && onCell(p, m.home)) {
    const points = bankPoints(w.bag) * bankRate(w)
    w.haul += w.bag
    w.bag = 0
    addScore(w, points, events)
    events.push({ kind: 'bank', points, x: m.home.x, y: m.home.y })
  }
}

function collide(w: World, events: GameEvent[]) {
  const p = w.player
  for (const g of w.ghouls) {
    if (g.mode !== 'hunt') continue
    const dx = Math.abs(g.x - p.x)
    const near = Math.min(dx, w.maze.cols - dx) < 0.7 && Math.abs(g.y - p.y) < 0.7
    if (!near) continue
    if (g.scared) {
      const points = 200 << Math.min(w.chain, 3)
      w.chain++
      g.mode = 'eyes'
      g.scared = false
      if (g.kind !== 'ghost') {
        // Eyes walk the pavement, so put them back on the grid.
        g.x = Math.round(g.x)
        g.y = Math.round(g.y)
        g.dir = null
      }
      addScore(w, points, events)
      events.push({ kind: 'eat', points, x: g.x, y: g.y })
    } else {
      w.phase = 'caught'
      w.phaseTime = 0
      events.push({ kind: 'caught' })
      if (w.bag > 0) events.push({ kind: 'spill' })
      w.bag = 0
      return
    }
  }
}

export function step(w: World, dt: number): GameEvent[] {
  const events: GameEvent[] = []
  w.phaseTime += dt
  switch (w.phase) {
    case 'ready':
      if (w.phaseTime >= READY_TIME) { w.phase = 'play'; w.phaseTime = 0 }
      break

    case 'play': {
      w.clock -= dt
      if (!w.midnight && w.clock <= 0) {
        w.midnight = true
        w.clock = 0
        events.push({ kind: 'midnight' })
      }
      if (w.lantern > 0) {
        w.lantern -= dt
        if (w.lantern <= 0) {
          w.lantern = 0
          for (const g of w.ghouls) g.scared = false
          events.push({ kind: 'lanternEnd' })
        }
      }
      movePlayer(w, dt)
      doorstep(w, events)
      collide(w, events)
      if (w.phase !== 'play') break
      for (const g of w.ghouls) moveGhoul(w, g, dt)
      collide(w, events)
      if (w.phase === 'play' && doorsLeft(w) === 0 && w.bag === 0) {
        const secs = w.midnight ? 0 : Math.ceil(w.clock)
        w.tally = { time: secs, points: secs * TIME_BONUS }
        addScore(w, w.tally.points, events)
        w.phase = 'cleared'
        w.phaseTime = 0
        events.push({ kind: 'cleared' })
      }
      break
    }

    case 'caught':
      if (w.phaseTime >= CAUGHT_TIME) {
        w.lives--
        if (w.lives <= 0) {
          w.phase = 'over'
          w.phaseTime = 0
          events.push({ kind: 'over' })
        } else {
          resetPositions(w)
          events.push({ kind: 'ready' })
        }
      }
      break

    case 'cleared':
    case 'over':
      break
  }
  return events
}

/** Ask to go a way; taken at the next corner it fits. */
export function steer(w: World, d: Dir | null): void {
  if (d) w.player.want = d
}
