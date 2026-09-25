// ─── /defend: the rules ─────────────────────────────────────────────────────
//
// Six cities and three missile bases along the ground. Enemy warheads fall
// from the sky in waves; you fire interceptors at points in the sky, each of
// which bursts into a fireball that destroys anything drifting into it.
// Pure: no drawing, no sound — `step` returns events for main.ts.
//
// Everything is in playfield pixels (W×H), y growing downward.

export const W = 180
export const H = 320
export const GROUND = 300
/** Interceptors can't be aimed lower than this (you'd hit your own city). */
export const MIN_AIM_Y = GROUND - 24

export const BASES_X = [16, 90, 164]
export const CITIES_X = [36, 52, 68, 112, 128, 144]
export const AMMO = 10
/** Interceptor speed, pixels per second. The centre base's are faster. */
export const INTERCEPTOR_SPEED = 260
export const CENTRE_SPEED = 360

/** Fireball size and timing: grows, holds, shrinks. */
export const BLAST_R = 17
export const BLAST_GROW = 0.45
export const BLAST_HOLD = 0.35
export const BLAST_SHRINK = 0.45
/** How close to a city or base a warhead must land to destroy it. */
export const HIT_RANGE = 9

export const BONUS_CITY_EVERY = 10000
export const POINTS = { warhead: 25, bomber: 100, drone: 125 }
export const CITY_BONUS = 100
export const AMMO_BONUS = 5

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

export interface Base { x: number; ammo: number; alive: boolean }
export interface City { x: number; alive: boolean }

export interface Interceptor {
  x: number; y: number
  sx: number; sy: number
  tx: number; ty: number
  speed: number
}

export interface Blast {
  x: number; y: number
  t: number
  /** Enemy blasts (warheads hitting the ground) don't destroy other enemies. */
  enemy: boolean
}

export type EnemyKind = 'warhead' | 'bomber' | 'drone'

export interface Enemy {
  kind: EnemyKind
  x: number; y: number
  /** Where it came from (for the trail). */
  sx: number; sy: number
  vx: number; vy: number
  /** Warheads: split into this many when they pass `splitY` (0 = never). */
  split: number
  splitY: number
  /** Bombers: seconds until the next drop. */
  drop: number
  /** Drones: current sidestep. */
  dodge: number
}

export interface WaveDef {
  /** Warheads to launch (children of splits not counted). */
  warheads: number
  /** Fall speed, pixels per second. */
  speed: number
  /** Seconds between launches. */
  gap: number
  /** Chance a warhead splits, and into how many. */
  splitChance: number
  splitInto: number
  bombers: number
  drones: number
}

/** Wave `n` (1-based). Everything ramps up; new enemy types join in. */
export function waveDef(n: number): WaveDef {
  const k = n - 1
  return {
    warheads: Math.min(30, 12 + Math.floor(k * 2.5)),
    speed: Math.min(90, 20 + k * 8),
    gap: Math.max(0.45, 1.6 - k * 0.12),
    splitChance: n < 3 ? 0 : Math.min(0.45, 0.12 + (n - 3) * 0.05),
    splitInto: n < 6 ? 2 : 3,
    bombers: n < 4 ? 0 : Math.min(3, Math.floor((n - 2) / 2)),
    drones: n < 6 ? 0 : Math.min(4, n - 5),
  }
}

/** Score multiplier, as in the arcade: rises every two waves. */
export const multiplier = (wave: number) => Math.min(6, Math.ceil(wave / 2))

export type Phase = 'wave' | 'tally' | 'over'

export interface World {
  wave: number
  def: WaveDef
  phase: Phase
  phaseTime: number
  bases: Base[]
  cities: City[]
  interceptors: Interceptor[]
  blasts: Blast[]
  enemies: Enemy[]
  /** Enemies still to launch this wave. */
  toLaunch: { warheads: number; bombers: number; drones: number }
  launchTimer: number
  score: number
  /** Next score at which a lost city is rebuilt. */
  nextBonusCity: number
  /** Cities earned but not yet placed (placed at the start of a wave). */
  spareCities: number
  /** End-of-wave bonus, for the tally screen. */
  tally: { cities: number; ammo: number; points: number }
  rnd: Rng
}

export type EventKind =
  | 'fire' | 'empty' | 'blast' | 'kill' | 'split' | 'impact' | 'cityLost' | 'baseLost'
  | 'wave' | 'cleared' | 'bonusCity' | 'over'

export interface WorldEvent {
  kind: EventKind
  x?: number
  y?: number
  detail?: string
}

export function createWorld(seed = 1): World {
  const w: World = {
    wave: 0, def: waveDef(1), phase: 'wave', phaseTime: 0,
    bases: BASES_X.map(x => ({ x, ammo: AMMO, alive: true })),
    cities: CITIES_X.map(x => ({ x, alive: true })),
    interceptors: [], blasts: [], enemies: [],
    toLaunch: { warheads: 0, bombers: 0, drones: 0 },
    launchTimer: 0, score: 0, nextBonusCity: BONUS_CITY_EVERY, spareCities: 0,
    tally: { cities: 0, ammo: 0, points: 0 },
    rnd: makeRng(seed),
  }
  startWave(w, 1)
  return w
}

export function startWave(w: World, n: number): WorldEvent[] {
  w.wave = n
  w.def = waveDef(n)
  w.phase = 'wave'
  w.phaseTime = 0
  for (const b of w.bases) { b.alive = true; b.ammo = AMMO }
  // Earned cities come back before the wave starts.
  while (w.spareCities > 0 && w.cities.some(c => !c.alive)) {
    w.cities.find(c => !c.alive)!.alive = true
    w.spareCities--
  }
  w.interceptors = []
  w.blasts = []
  w.enemies = []
  w.toLaunch = { warheads: w.def.warheads, bombers: w.def.bombers, drones: w.def.drones }
  w.launchTimer = 1.2
  return [{ kind: 'wave', detail: String(n) }]
}

export const citiesLeft = (w: World) => w.cities.filter(c => c.alive).length
export const ammoLeft = (w: World) => w.bases.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0)

/** Something on the ground an enemy can aim at: a live city or base. */
function pickTarget(w: World): number {
  const spots = [
    ...w.cities.filter(c => c.alive).map(c => c.x),
    ...w.bases.filter(b => b.alive).map(b => b.x),
  ]
  // Nothing left standing: aim anywhere (the game is about to end).
  if (spots.length === 0) return 20 + w.rnd() * (W - 40)
  return spots[Math.floor(w.rnd() * spots.length)]
}

function aimAt(w: World, sx: number, sy: number, speed: number): Pick<Enemy, 'vx' | 'vy'> {
  const tx = pickTarget(w)
  const dx = tx - sx
  const dy = GROUND - sy
  const d = Math.hypot(dx, dy) || 1
  return { vx: (dx / d) * speed, vy: (dy / d) * speed }
}

function launchWarhead(w: World, sx = 8 + w.rnd() * (W - 16), sy = 0, split = true): Enemy {
  const splits = split && w.rnd() < w.def.splitChance
  return {
    kind: 'warhead', x: sx, y: sy, sx, sy, ...aimAt(w, sx, sy, w.def.speed),
    split: splits ? w.def.splitInto : 0,
    splitY: 70 + w.rnd() * 110,
    drop: 0, dodge: 0,
  }
}

function launch(w: World): void {
  const { toLaunch: q } = w
  const pool: EnemyKind[] = []
  if (q.warheads > 0) pool.push('warhead', 'warhead', 'warhead')
  if (q.bombers > 0) pool.push('bomber')
  if (q.drones > 0) pool.push('drone')
  if (pool.length === 0) return
  const kind = pool[Math.floor(w.rnd() * pool.length)]
  if (kind === 'warhead') {
    q.warheads--
    w.enemies.push(launchWarhead(w))
  } else if (kind === 'bomber') {
    q.bombers--
    const fromLeft = w.rnd() < 0.5
    const y = 50 + w.rnd() * 60
    const x = fromLeft ? -10 : W + 10
    w.enemies.push({
      kind: 'bomber', x, y, sx: x, sy: y, vx: (fromLeft ? 1 : -1) * 22, vy: 0,
      split: 0, splitY: 0, drop: 1 + w.rnd() * 1.5, dodge: 0,
    })
  } else {
    q.drones--
    const x = 20 + w.rnd() * (W - 40)
    w.enemies.push({
      kind: 'drone', x, y: 0, sx: x, sy: 0, ...aimAt(w, x, 0, w.def.speed * 0.9),
      split: 0, splitY: 0, drop: 0, dodge: 0,
    })
  }
}

/** Blast radius at age `t` (0 once it's over). */
export function blastRadius(t: number): number {
  if (t < BLAST_GROW) return BLAST_R * (t / BLAST_GROW)
  if (t < BLAST_GROW + BLAST_HOLD) return BLAST_R
  const s = t - BLAST_GROW - BLAST_HOLD
  return s < BLAST_SHRINK ? BLAST_R * (1 - s / BLAST_SHRINK) : 0
}
const BLAST_LIFE = BLAST_GROW + BLAST_HOLD + BLAST_SHRINK

/**
 * Fire at (tx, ty) from the nearest live base with ammo, or from `baseIdx`
 * if given. Returns the event (`fire`, or `empty` if nothing can shoot).
 */
export function fire(w: World, tx: number, ty: number, baseIdx?: number): WorldEvent {
  if (w.phase !== 'wave') return { kind: 'empty' }
  ty = Math.min(ty, MIN_AIM_Y)
  tx = Math.max(0, Math.min(W, tx))
  const ready = (i: number) => w.bases[i].alive && w.bases[i].ammo > 0
  let pick = baseIdx !== undefined && ready(baseIdx) ? baseIdx : -1
  if (pick < 0 && baseIdx === undefined) {
    let best = Infinity
    w.bases.forEach((b, i) => {
      const d = Math.abs(b.x - tx)
      if (ready(i) && d < best) { best = d; pick = i }
    })
  }
  if (pick < 0) return { kind: 'empty' }
  const b = w.bases[pick]
  b.ammo--
  const sy = GROUND - 8
  w.interceptors.push({
    x: b.x, y: sy, sx: b.x, sy, tx, ty,
    speed: pick === 1 ? CENTRE_SPEED : INTERCEPTOR_SPEED,
  })
  return { kind: 'fire', x: b.x, detail: String(pick) }
}

function addScore(w: World, points: number, events: WorldEvent[]) {
  w.score += points
  while (w.score >= w.nextBonusCity) {
    w.nextBonusCity += BONUS_CITY_EVERY
    w.spareCities++
    events.push({ kind: 'bonusCity' })
  }
}

export function step(w: World, dt: number): WorldEvent[] {
  const events: WorldEvent[] = []
  w.phaseTime += dt
  if (w.phase !== 'wave') return events

  // ── Launch ──
  w.launchTimer -= dt
  if (w.launchTimer <= 0) {
    launch(w)
    w.launchTimer = w.def.gap * (0.6 + w.rnd() * 0.8)
  }

  // ── Interceptors ──
  for (const m of w.interceptors) {
    const dx = m.tx - m.x
    const dy = m.ty - m.y
    const d = Math.hypot(dx, dy)
    const move = m.speed * dt
    if (d <= move) {
      m.x = m.tx
      m.y = m.ty
      w.blasts.push({ x: m.tx, y: m.ty, t: 0, enemy: false })
      events.push({ kind: 'blast', x: m.tx, y: m.ty })
      m.speed = 0
    } else {
      m.x += (dx / d) * move
      m.y += (dy / d) * move
    }
  }
  w.interceptors = w.interceptors.filter(m => m.speed > 0)

  // ── Blasts ──
  for (const b of w.blasts) b.t += dt
  w.blasts = w.blasts.filter(b => b.t < BLAST_LIFE)

  // ── Enemies ──
  const mult = multiplier(w.wave)
  const spawned: Enemy[] = []
  for (const e of w.enemies) {
    if (e.kind === 'drone') {
      // Drones sidestep away from any of your fireballs they see coming.
      let push = 0
      for (const b of w.blasts) {
        if (b.enemy) continue
        const dx = e.x - b.x
        const dy = e.y - b.y
        const reach = blastRadius(b.t) + 22
        if (Math.abs(dx) < reach && dy > -reach && dy < reach * 1.5) push += Math.sign(dx || 1)
      }
      e.dodge += (push * 50 - e.dodge) * Math.min(1, dt * 4)
      e.x = Math.max(4, Math.min(W - 4, e.x + e.dodge * dt))
    }
    e.x += e.vx * dt
    e.y += e.vy * dt
    if (e.kind === 'bomber') {
      e.drop -= dt
      if (e.drop <= 0 && e.x > 10 && e.x < W - 10) {
        e.drop = 1.6 + w.rnd() * 1.6
        spawned.push(launchWarhead(w, e.x, e.y + 4, false))
      }
    }
    if (e.kind === 'warhead' && e.split > 0 && e.y >= e.splitY) {
      for (let i = 0; i < e.split; i++) spawned.push(launchWarhead(w, e.x, e.y, false))
      events.push({ kind: 'split', x: e.x, y: e.y })
      e.y = Infinity // replaced by its children
    }
  }

  // Caught in one of your fireballs?
  for (const e of w.enemies) {
    if (!Number.isFinite(e.y)) continue
    for (const b of w.blasts) {
      if (b.enemy) continue
      const r = blastRadius(b.t)
      if (Math.hypot(e.x - b.x, e.y - b.y) <= r + (e.kind === 'bomber' ? 4 : 1)) {
        addScore(w, POINTS[e.kind] * mult, events)
        events.push({ kind: 'kill', x: e.x, y: e.y, detail: e.kind })
        // A kill sets off its own small fireball, so chains are possible.
        w.blasts.push({ x: e.x, y: e.y, t: BLAST_GROW * 0.4, enemy: false })
        e.y = Infinity
        break
      }
    }
  }

  // Reaching the ground.
  for (const e of w.enemies) {
    if (!Number.isFinite(e.y) || e.y < GROUND) continue
    const x = e.x
    e.y = Infinity
    w.blasts.push({ x, y: GROUND, t: 0, enemy: true })
    events.push({ kind: 'impact', x, y: GROUND })
    for (const c of w.cities) {
      if (c.alive && Math.abs(c.x - x) <= HIT_RANGE) {
        c.alive = false
        events.push({ kind: 'cityLost', x: c.x })
      }
    }
    for (const b of w.bases) {
      if (b.alive && Math.abs(b.x - x) <= HIT_RANGE) {
        b.alive = false
        b.ammo = 0
        events.push({ kind: 'baseLost', x: b.x })
      }
    }
  }

  w.enemies = w.enemies.filter(e => Number.isFinite(e.y) && e.x > -30 && e.x < W + 30)
  w.enemies.push(...spawned)

  // ── Wave over? ──
  const queued = w.toLaunch.warheads + w.toLaunch.bombers + w.toLaunch.drones
  const settled = w.enemies.length === 0 && w.interceptors.length === 0 && w.blasts.every(b => b.enemy)
  if (queued === 0 && settled) {
    const cities = citiesLeft(w)
    if (cities === 0 && w.spareCities === 0) {
      w.phase = 'over'
      w.phaseTime = 0
      events.push({ kind: 'over' })
    } else {
      const ammo = ammoLeft(w)
      const points = (cities * CITY_BONUS + ammo * AMMO_BONUS) * mult
      w.tally = { cities, ammo, points }
      addScore(w, points, events)
      w.phase = 'tally'
      w.phaseTime = 0
      events.push({ kind: 'cleared' })
    }
  }
  return events
}
