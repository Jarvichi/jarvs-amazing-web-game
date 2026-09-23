// ─── /shmup: enemies ────────────────────────────────────────────────────────
//
// Enemy stats, their scripted flight paths and attacks, spawning from the
// level's wave timeline, and player shots hitting them.

import {
  BULLET_DAMAGE, ENEMY_SHOT_SPEED, H, SCROLL_SPEED, W, hit, rand, tierScale,
  type Enemy, type EnemyDef, type EnemyKind, type GameEvent, type World,
} from './world'

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drifter: { hp: 2, score: 100, credits: 5, w: 12, h: 12, capsule: 0 },
  swooper: { hp: 1, score: 150, credits: 5, w: 12, h: 10, capsule: 0 },
  spinner: { hp: 3, score: 200, credits: 10, w: 12, h: 12, capsule: 0.05 },
  darter: { hp: 5, score: 250, credits: 15, w: 14, h: 14, capsule: 0.2 },
  turret: { hp: 8, score: 300, credits: 20, w: 16, h: 16, capsule: 0.25 },
}

export function aimAt(w: World, x: number, y: number, speed = ENEMY_SHOT_SPEED, spread = 0) {
  const a = Math.atan2(w.ship.y - y, w.ship.x - x) + spread
  w.enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: BULLET_DAMAGE })
}

/** Aimed shot from a regular enemy, at this level's tier speed. */
function enemyShot(w: World, x: number, y: number, speed = ENEMY_SHOT_SPEED, spread = 0) {
  aimAt(w, x, y, speed * tierScale(w.level.tier).speed, spread)
}

function moveEnemy(w: World, e: Enemy, dt: number) {
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
      if (e.y > 20 && (e.fire -= dt) <= 0) { e.fire = 2 / rate; enemyShot(w, e.x, e.y) }
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
  }
}

export function killEnemy(w: World, e: Enemy, ev: GameEvent[]) {
  const def = ENEMIES[e.kind]
  w.score += def.score
  ev.push({ kind: e.kind === 'turret' || e.kind === 'darter' ? 'bigexplode' : 'explode', x: e.x, y: e.y })
  w.pickups.push({ x: e.x, y: e.y, kind: 'credit', value: def.credits })
  if (rand(w) < def.capsule) w.pickups.push({ x: e.x + 6, y: e.y, kind: 'capsule', value: 0 })
}

/** Add an enemy with tier-scaled health. Used by the wave timeline and by bosses' summons. */
export function spawnEnemy(w: World, kind: EnemyKind, x: number, y: number, p = 0): Enemy {
  const e: Enemy = {
    id: w.nextId++, kind, x, y, sx: x, p,
    hp: Math.ceil(ENEMIES[kind].hp * tierScale(w.level.tier).hp), age: 0, fire: 0.6 + rand(w), flash: 0,
  }
  w.enemies.push(e)
  return e
}

export function stepEnemies(w: World, dt: number, ev: GameEvent[]) {
  while (w.nextSpawn < w.spawns.length && w.spawns[w.nextSpawn].at <= w.time) {
    const s = w.spawns[w.nextSpawn++]
    spawnEnemy(w, s.kind, s.x, -ENEMIES[s.kind].h, s.p)
  }
  for (const e of w.enemies) {
    e.age += dt
    e.flash = Math.max(0, e.flash - dt)
    moveEnemy(w, e, dt)
  }

  // Player shots vs enemies
  for (const b of w.shots) {
    for (const e of w.enemies) {
      if (e.hp <= 0) continue
      const def = ENEMIES[e.kind]
      if (!hit(b.x, b.y, 3, 6, e.x, e.y, def.w, def.h)) continue
      e.hp -= b.dmg
      e.flash = 0.06
      b.y = -100 // spent
      if (e.hp <= 0) killEnemy(w, e, ev)
      else ev.push({ kind: 'hit', x: b.x, y: e.y })
      break
    }
  }

  w.enemies = w.enemies.filter(e => e.hp > 0 && e.y < H + 24 && e.x > -40 && e.x < W + 40 && e.y > -60)
}

