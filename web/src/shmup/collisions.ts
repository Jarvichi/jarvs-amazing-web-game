// ─── /shmup: pickups and damage ─────────────────────────────────────────────
//
// Credits and capsules, and everything that can hurt the ship.

import {
  H, MAX_SHIELD, RAM_DAMAGE, SHIP_H, SHIP_W, hit, rand, type GameEvent, type Loadout, type World,
} from './world'
import { ENEMIES, killEnemy } from './enemies'

const CAPSULE_UPGRADES = ['cannon', 'side', 'rear', 'homing', 'speed', 'shield'] as const

/** Grant a random upgrade the ship doesn't already max out; shield otherwise. */
export function applyCapsule(w: World): string {
  const l = w.loadout
  const options = CAPSULE_UPGRADES.filter(u =>
    (u === 'cannon' && l.cannon < 3) || (u === 'side' && !l.side) || (u === 'rear' && !l.rear) ||
    (u === 'homing' && l.homing < 2) || (u === 'speed' && l.speed < 2))
  const pick = options.length ? options[Math.floor(rand(w) * options.length)] : 'shield'
  switch (pick) {
    case 'cannon': l.cannon = (l.cannon + 1) as Loadout['cannon']; break
    case 'side': l.side = true; break
    case 'rear': l.rear = true; break
    case 'homing': l.homing = (l.homing + 1) as Loadout['homing']; break
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'shield': w.ship.shield = MAX_SHIELD; break
  }
  return pick
}

export function damageShip(w: World, amount: number, ev: GameEvent[]) {
  const s = w.ship
  if (!s.alive || s.invuln > 0) return
  s.shield -= amount
  s.invuln = 0.4
  ev.push({ kind: 'hurt', x: s.x, y: s.y })
  if (s.shield > 0) return
  s.alive = false
  s.respawn = 2
  w.lives--
  // Losing a ship costs a cannon level.
  w.loadout.cannon = Math.max(1, w.loadout.cannon - 1) as Loadout['cannon']
  w.enemyShots = []
  ev.push({ kind: 'die', x: s.x, y: s.y })
  if (w.lives <= 0) w.status = 'gameover'
}

export function stepCollisions(w: World, dt: number, ev: GameEvent[]) {
  const s = w.ship
  for (const p of w.pickups) {
    p.y += (p.kind === 'credit' ? 45 : 35) * dt
    // Credits drift toward a nearby ship so they're satisfying to hoover up.
    if (s.alive && Math.hypot(p.x - s.x, p.y - s.y) < 28) {
      p.x += (s.x - p.x) * Math.min(1, 6 * dt)
      p.y += (s.y - p.y) * Math.min(1, 6 * dt)
    }
  }
  if (s.alive) {
    w.pickups = w.pickups.filter(p => {
      if (!hit(p.x, p.y, 10, 10, s.x, s.y, SHIP_W + 6, SHIP_H + 6)) return true
      if (p.kind === 'credit') {
        w.credits += p.value
        ev.push({ kind: 'credit', x: p.x, y: p.y })
      } else {
        ev.push({ kind: 'capsule', x: p.x, y: p.y, detail: applyCapsule(w) })
      }
      return false
    })
  }
  w.pickups = w.pickups.filter(p => p.y < H + 10)

  if (!s.alive) return
  for (const b of w.enemyShots) {
    if (hit(b.x, b.y, 3, 3, s.x, s.y, SHIP_W, SHIP_H)) {
      b.y = H + 100
      damageShip(w, b.dmg, ev)
    }
  }
  for (const e of w.enemies) {
    const def = ENEMIES[e.kind]
    if (e.hp > 0 && hit(e.x, e.y, def.w, def.h, s.x, s.y, SHIP_W, SHIP_H)) {
      damageShip(w, RAM_DAMAGE, ev)
      e.hp -= 5
      if (e.hp <= 0) killEnemy(w, e, ev)
    }
  }
  const b = w.boss
  if (b && !b.dying && hit(b.x, b.y, 40, 28, s.x, s.y, SHIP_W, SHIP_H)) damageShip(w, RAM_DAMAGE, ev)
}

