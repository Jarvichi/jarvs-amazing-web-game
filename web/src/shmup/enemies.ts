// ─── /shmup: enemies ────────────────────────────────────────────────────────
//
// Enemy stats, their scripted flight paths and attacks, spawning from the
// level's wave timeline, and player shots hitting them.

import {
  BULLET_DAMAGE, ENEMY_SHOT_SPEED, H, REAR_WARNING, SCROLL_SPEED, W, hit, rand, tierScale,
  type Enemy, type EnemyDef, type EnemyKind, type GameEvent, type World,
} from './world'
import { powerScale } from './difficulty'

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drifter: { hp: 2, score: 100, credits: 5, w: 12, h: 12 },
  swooper: { hp: 1, score: 150, credits: 5, w: 12, h: 10 },
  spinner: { hp: 3, score: 200, credits: 10, w: 12, h: 12 },
  darter: { hp: 5, score: 250, credits: 15, w: 14, h: 14 },
  turret: { hp: 8, score: 300, credits: 20, w: 16, h: 16 },
  splitter: { hp: 6, score: 200, credits: 10, w: 16, h: 16 },
  mine: { hp: 3, score: 150, credits: 10, w: 12, h: 12 },
  snake: { hp: 3, score: 80, credits: 5, w: 10, h: 10 },
  sniper: { hp: 6, score: 350, credits: 20, w: 14, h: 14 },
  carrier: { hp: 18, score: 800, credits: 40, w: 24, h: 18 },
}

const BIG: EnemyKind[] = ['turret', 'darter', 'splitter', 'sniper', 'carrier']
const SNIPER_SHOT_SPEED = 220
const MINE_FUSE_RANGE = 22

export function aimAt(w: World, x: number, y: number, speed = ENEMY_SHOT_SPEED, spread = 0) {
  const a = Math.atan2(w.ship.y - y, w.ship.x - x) + spread
  w.enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: BULLET_DAMAGE })
}

/** Aimed shot from a regular enemy, at this level's tier speed. */
function enemyShot(w: World, x: number, y: number, speed = ENEMY_SHOT_SPEED, spread = 0) {
  aimAt(w, x, y, speed * tierScale(w.level.tier).speed, spread)
}

/** A burst of `n` shots in every direction. */
function ring(w: World, x: number, y: number, n: number, speed: number) {
  const v = speed * tierScale(w.level.tier).speed
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    w.enemyShots.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg: BULLET_DAMAGE })
  }
}

function moveEnemy(w: World, e: Enemy, dt: number, ev: GameEvent[]) {
  const t = e.age
  const rate = tierScale(w.level.tier).fire
  switch (e.kind) {
    case 'drifter':
      e.y += 50 * dt
      e.x = e.sx + Math.sin(t * 2 + e.p) * 25
      break
    case 'swooper': {
      const dir = e.p || 1
      e.y = -10 + 130 * t - Math.max(0, t - 1) ** 2 * 60
      e.x = e.sx + dir * Math.max(0, t - 0.7) ** 2 * 90
      break
    }
    case 'spinner':
      e.y += 70 * dt
      if (e.y > 20 && (e.fire -= dt) <= 0) { e.fire = 2 / rate; enemyShot(w, e.x, e.below ? H - e.y : e.y) }
      break
    case 'turret':
      e.y += SCROLL_SPEED * dt
      if (e.y > 16 && (e.fire -= dt) <= 0) { e.fire = 1.6 / rate; enemyShot(w, e.x, e.y) }
      break
    case 'darter': {
      const hover = 60 + (e.p || 0)
      if (t < 1.2) e.y += (hover - e.y) * Math.min(1, 4 * dt)
      else if (t < 2.6) {
        if ((e.fire -= dt) <= 0) {
          e.fire = 99
          for (const s of [-0.25, 0, 0.25]) enemyShot(w, e.x, e.y, 100, s)
        }
      } else {
        e.y += 170 * dt
        e.x += Math.sign(w.ship.x - e.x) * 60 * dt
      }
      break
    }
    case 'splitter':
      e.y += 35 * dt
      e.x = e.sx + Math.sin(t * 1.3 + e.p) * 18
      break
    case 'mine':
      e.y += 22 * dt
      e.x = e.sx + Math.sin(t * 3) * 3
      // Flying too close sets it off.
      if (w.ship.alive && Math.hypot(w.ship.x - e.x, w.ship.y - e.y) < MINE_FUSE_RANGE) {
        e.hp = 0
        killEnemy(w, e, ev)
      }
      break
    case 'snake':
      // Every segment follows the same path, spawned a beat apart, so the
      // wave trails behind its head like a chain.
      e.y += 60 * dt
      e.x = e.sx + Math.sin(t * 2.2) * 50 * (e.p || 1)
      break
    case 'sniper': {
      const hover = 40 + (e.p || 0)
      if (t < 1) { e.y += (hover - e.y) * Math.min(1, 4 * dt); break }
      if (t > 8) { e.y -= 80 * dt; break } // leave upwards
      if (e.aim) {
        e.aim.t -= dt
        if (e.aim.t <= 0) {
          const a = Math.atan2(e.aim.y - e.y, e.aim.x - e.x)
          const v = SNIPER_SHOT_SPEED * tierScale(w.level.tier).speed
          w.enemyShots.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg: BULLET_DAMAGE })
          e.aim = undefined
          e.fire = 2.2 / rate
        }
      } else if ((e.fire -= dt) <= 0) {
        // Lock on where the ship is now; it fires there after the warning.
        e.aim = { x: w.ship.x, y: w.ship.y, t: 0.8 }
      }
      break
    }
    case 'carrier':
      e.y += 16 * dt
      e.x = e.sx + Math.sin(t * 0.7) * 20
      if (e.y > 10 && (e.fire -= dt) <= 0) {
        e.fire = 2.4 / rate
        spawnEnemy(w, 'swooper', e.x - 8, e.y, -1)
        spawnEnemy(w, 'swooper', e.x + 8, e.y, 1)
      }
      break
  }
}

export function killEnemy(w: World, e: Enemy, ev: GameEvent[]) {
  const def = ENEMIES[e.kind]
  w.score += def.score
  ev.push({ kind: BIG.includes(e.kind) ? 'bigexplode' : 'explode', x: e.x, y: e.y })
  w.pickups.push({ x: e.x, y: e.y, kind: 'credit', value: def.credits })
  // Capsules are earned, not random: wipe out a gold bonus formation, none escaping.
  if (e.wave !== undefined) {
    const stats = w.waveStats[e.wave]
    stats.killed++
    if (stats.killed === stats.n && stats.escaped === 0 && w.level.waves[e.wave].bonus) {
      w.pickups.push({ x: e.x + 6, y: e.y, kind: 'capsule', value: 0 })
      ev.push({ kind: 'wavebonus', x: e.x, y: e.y })
    }
  }
  if (e.kind === 'splitter') {
    spawnEnemy(w, 'drifter', e.x - 6, e.y, 0)
    spawnEnemy(w, 'drifter', e.x + 6, e.y, Math.PI)
  }
  if (e.kind === 'mine') ring(w, e.x, e.y, 8, 75)
}

/**
 * Enemies can't be hurt until they're fully on screen: otherwise a big
 * fleet's wall of bullets at the top edge kills them before they appear.
 */
export function onScreen(e: Enemy): boolean {
  const half = ENEMIES[e.kind].h / 2
  return e.y - half >= 0 && e.y + half <= H
}

/** Add an enemy with tier-scaled health. Used by the wave timeline and by bosses' summons. */
export function spawnEnemy(
  w: World, kind: EnemyKind, x: number, y: number, p = 0, member = 0, below = false,
): Enemy {
  const e: Enemy = {
    id: w.nextId++, kind, x, y, sx: x, p, member, below,
    hp: Math.ceil(ENEMIES[kind].hp * tierScale(w.level.tier).hp * powerScale(w.loadout, w.level.tier)),
    age: 0, fire: 0.6 + rand(w), flash: 0,
  }
  w.enemies.push(e)
  return e
}

export function stepEnemies(w: World, dt: number, ev: GameEvent[]) {
  // Announce rear waves as their warning window opens (once per wave).
  for (let i = w.nextSpawn; i < w.spawns.length && w.spawns[i].at - REAR_WARNING <= w.time; i++) {
    const s = w.spawns[i]
    if (s.below && s.i === 0 && s.at - REAR_WARNING > w.time - dt) ev.push({ kind: 'rearwarn', x: s.x, y: H })
  }
  while (w.nextSpawn < w.spawns.length && w.spawns[w.nextSpawn].at <= w.time) {
    const s = w.spawns[w.nextSpawn++]
    const h = ENEMIES[s.kind].h
    spawnEnemy(w, s.kind, s.x, s.below ? H + h : -h, s.p, s.i, s.below).wave = s.wave
  }
  for (const e of w.enemies) {
    e.age += dt
    e.flash = Math.max(0, e.flash - dt)
    // Rear attackers fly the same scripts in mirrored coordinates.
    if (e.below) e.y = H - e.y
    moveEnemy(w, e, dt, ev)
    if (e.below) e.y = H - e.y
  }

  // Player shots vs enemies. Piercing shots carry on, but damage each enemy once.
  for (const b of w.shots) {
    for (const e of w.enemies) {
      if (e.hp <= 0 || b.hitIds?.includes(e.id) || !onScreen(e)) continue
      const def = ENEMIES[e.kind]
      if (!hit(b.x, b.y, 3, 6, e.x, e.y, def.w, def.h)) continue
      e.hp -= b.dmg
      e.flash = 0.06
      if (e.hp <= 0) killEnemy(w, e, ev)
      else ev.push({ kind: 'hit', x: b.x, y: e.y })
      if (b.pierce) { (b.hitIds ??= []).push(e.id); continue }
      b.y = -100 // spent
      break
    }
  }

  w.enemies = w.enemies.filter(e => {
    if (e.hp <= 0) return false
    const inBounds = e.y < H + 24 && e.x > -40 && e.x < W + 40 && e.y > -60
    // Leaving the playfield alive spoils its wave's flawless bonus.
    if (!inBounds && e.wave !== undefined) w.waveStats[e.wave].escaped++
    return inBounds
  })
}


/** Rear waves due within the warning window: where their arrows go, and seconds until they arrive. */
export function rearWarnings(w: World): { x: number; t: number }[] {
  const out: { x: number; t: number }[] = []
  for (let i = w.nextSpawn; i < w.spawns.length && w.spawns[i].at - REAR_WARNING <= w.time; i++) {
    const s = w.spawns[i]
    if (s.below) out.push({ x: s.x, t: s.at - w.time })
  }
  return out
}
