// ─── /shmup: bosses ──────────────────────────────────────────────────────────
//
// Boss entry, movement, attacks and damage. Attacks are data (see `Attack`
// in world.ts), grouped into phases that take over as the boss is worn down;
// the core is armoured until every pod is destroyed.

import {
  BOSS_CREDITS, BULLET_DAMAGE, SHIP_W, W, hit, rand,
  type Attack, type Boss, type BossPart, type GameEvent, type World,
} from './world'
import { aimAt, spawnEnemy } from './enemies'
import { damageShip } from './collisions'

const BOSS_Y = 64
const LASER_DAMAGE = 35

export function spawnBoss(w: World, ev: GameEvent[]) {
  const d = w.level.boss
  const part = (index: number, ox: number, oy: number, hp: number, pw: number, ph: number): BossPart =>
    ({ index, ox, oy, hp, max: hp, w: pw, h: ph, timers: [], spin: 0, flash: 0 })
  const b: Boss = {
    def: d,
    x: W / 2,
    y: -50,
    t: 0,
    core: part(-1, 0, 0, d.coreHp, 36, 24),
    pods: d.pods.map((p, i) => part(i, p.ox, p.oy, d.podHp, 14, 14)),
    phase: 0,
    lasers: [],
    dying: 0,
  }
  resetTimers(w, b)
  w.boss = b
  ev.push({ kind: 'boss', x: W / 2, y: 0 })
}

export function coreExposed(b: Boss): boolean {
  return b.pods.every(p => p.hp <= 0)
}

/** A part's current position, including its independent bobbing. */
export function partPos(b: Boss, p: BossPart): { x: number; y: number } {
  const def = p.index >= 0 ? b.def.pods[p.index] : undefined
  const f = def?.freq ?? 1
  return {
    x: b.x + p.ox + Math.sin(b.t * f + p.index) * (def?.ax ?? 0),
    y: b.y + p.oy + Math.cos(b.t * f * 1.3 + p.index) * (def?.ay ?? 0),
  }
}

export function healthFraction(b: Boss): number {
  const parts = [b.core, ...b.pods]
  return parts.reduce((s, p) => s + Math.max(0, p.hp), 0) / parts.reduce((s, p) => s + p.max, 0)
}

/** Index of the phase that should be running now. */
export function currentPhase(b: Boss): number {
  const exposed = coreExposed(b)
  const frac = healthFraction(b)
  let idx = 0
  b.def.phases.forEach((ph, i) => {
    if (ph.when === undefined) return
    if (ph.when === 'exposed' ? exposed : frac <= ph.when) idx = i
  })
  return idx
}

function resetTimers(w: World, b: Boss) {
  const ph = b.def.phases[b.phase]
  // Stagger first volleys so a new phase doesn't open with everything at once.
  b.core.timers = ph.core.map(a => Math.min(a.every, 0.8) + rand(w) * 0.6)
  for (const p of b.pods) p.timers = ph.pods.map(a => Math.min(a.every, 0.8) + rand(w) * 1.2)
}

function shot(w: World, x: number, y: number, angle: number, speed: number) {
  w.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg: BULLET_DAMAGE })
}

function fire(w: World, b: Boss, part: BossPart, a: Attack, ev: GameEvent[]) {
  const { x, y } = partPos(b, part)
  const oy = y + part.h / 2
  switch (a.kind) {
    case 'fan':
      for (let i = 0; i < a.n; i++) shot(w, x, oy, Math.PI / 2 + (i - (a.n - 1) / 2) * a.spread, a.speed)
      break
    case 'aimed':
      for (let i = 0; i < a.n; i++) aimAt(w, x, oy, a.speed + i * 14)
      break
    case 'ring':
      for (let i = 0; i < a.n; i++) shot(w, x, y, (i / a.n) * Math.PI * 2 + b.t, a.speed)
      break
    case 'spiral':
      part.spin += a.spin
      for (let i = 0; i < a.arms; i++) shot(w, x, y, part.spin + (i / a.arms) * Math.PI * 2, a.speed)
      break
    case 'summon':
      for (let i = 0; i < a.n && w.enemies.length < a.max; i++) {
        spawnEnemy(w, a.enemy, x + (i - (a.n - 1) / 2) * 16, oy, i % 2 ? 1 : -1)
      }
      break
    case 'laser':
      b.lasers.push({ part, x, y: oy, t: 0, warn: a.warn, dur: a.dur, width: a.width, track: !!a.track })
      ev.push({ kind: 'laser', x, y: oy })
      break
  }
}

function stepLasers(w: World, b: Boss, dt: number) {
  for (const l of b.lasers) {
    l.t += dt
    if (l.track && l.part.hp > 0) {
      const p = partPos(b, l.part)
      l.x = p.x
      l.y = p.y + l.part.h / 2
    }
  }
  // A beam dies with its emitter, or when it has burned out.
  b.lasers = b.lasers.filter(l => l.t < l.warn + l.dur && l.part.hp > 0)
}

/** Burning lasers that overlap the ship this tick. */
export function laserHits(w: World, b: Boss): boolean {
  const s = w.ship
  return b.lasers.some(l => l.t >= l.warn && s.y > l.y && Math.abs(s.x - l.x) < (l.width + SHIP_W) / 2)
}

export function stepBoss(w: World, dt: number, ev: GameEvent[]) {
  const b = w.boss
  if (!b) return
  b.t += dt
  if (b.dying > 0) {
    b.dying += dt
    b.lasers = []
    if (Math.floor(b.dying * 8) !== Math.floor((b.dying - dt) * 8)) {
      ev.push({ kind: 'explode', x: b.x + (rand(w) - 0.5) * 60, y: b.y + (rand(w) - 0.5) * 36 })
    }
    if (b.dying > 2.5) w.status = 'won'
    return
  }

  const phase = currentPhase(b)
  if (phase !== b.phase) {
    b.phase = phase
    b.lasers = []
    resetTimers(w, b)
    ev.push({ kind: 'phase', x: b.x, y: b.y })
  }
  const ph = b.def.phases[b.phase]

  // Enter, then sway across the top of the screen.
  const ready = b.y >= BOSS_Y
  if (!ready) b.y = Math.min(BOSS_Y, b.y + 30 * dt)
  else b.x = W / 2 + Math.sin(b.t * ph.sway) * (ph.swayWidth ?? 36)

  const emit = (part: BossPart, attacks: Attack[]) => {
    part.flash = Math.max(0, part.flash - dt)
    if (!ready || part.hp <= 0) return
    attacks.forEach((a, i) => {
      if ((part.timers[i] -= dt) > 0) return
      part.timers[i] = a.every
      fire(w, b, part, a, ev)
    })
  }
  for (const p of b.pods) emit(p, ph.pods)
  emit(b.core, ph.core)
  stepLasers(w, b, dt)
  if (laserHits(w, b)) damageShip(w, LASER_DAMAGE, ev)

  const exposed = coreExposed(b)
  const c = b.core
  for (const s of w.shots) {
    for (const p of [...b.pods, c]) {
      if (p.hp <= 0) continue
      const pos = partPos(b, p)
      if (!hit(s.x, s.y, 3, 6, pos.x, pos.y, p.w, p.h)) continue
      const hy = s.y
      if (!s.pierce) s.y = -100 // spent
      if (p === c && !exposed) { ev.push({ kind: 'hit', x: s.x, y: hy }); break } // armoured
      p.hp -= s.dmg
      p.flash = 0.06
      if (p.hp <= 0) {
        if (p === c) {
          b.dying = dt
          w.score += 5000
          // Paid out directly: a dropped pickup couldn't reach the ship before
          // the level ends.
          w.credits += BOSS_CREDITS
          ev.push({ kind: 'bossdie', x: b.x, y: b.y })
        } else {
          w.score += 1000
          ev.push({ kind: 'podkill', x: pos.x, y: pos.y })
        }
      }
      break
    }
  }
}
