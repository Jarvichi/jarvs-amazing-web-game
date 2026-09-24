// ─── /shmup: pickups and damage ─────────────────────────────────────────────
//
// Credits and capsules, and everything that can hurt the ship.

import {
  H, MAX_BOMBS, RAM_DAMAGE, dronePos, maxShield, SHIP_H, SHIP_W, hit, rand, type GameEvent, type Loadout, type World,
} from './world'
import { ENEMIES, killEnemy } from './enemies'
import { mountPods, upgradeWeapon } from './pods'

// Laser, side and rear only come from the shop: each one mounts a pod
// outright, and capsules drop too often to hand those out free.
const CAPSULE_UPGRADES = ['cannon', 'homing', 'speed', 'drones', 'rapid', 'bomb', 'shield'] as const

/**
 * Grant a random upgrade the ship can still take (shield if none). Cannon and
 * homing always can: maxing them mounts a pod and starts them over.
 */
export function applyCapsule(w: World, ev: GameEvent[] = []): string {
  const l = w.loadout
  const options = CAPSULE_UPGRADES.filter(u =>
    u === 'cannon' || u === 'homing' || (u === 'speed' && l.speed < 2) ||
    (u === 'drones' && l.drones < 2) || (u === 'rapid' && l.rapid < 2) || (u === 'bomb' && l.bombs < MAX_BOMBS))
  const pick = options.length ? options[Math.floor(rand(w) * options.length)] : 'shield'
  switch (pick) {
    case 'cannon':
    case 'homing':
      upgradeWeapon(l, pick)
      for (const k of mountPods(l)) ev.push({ kind: 'mount', x: w.ship.x, y: w.ship.y, detail: k })
      break
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'drones': l.drones = (l.drones + 1) as Loadout['drones']; break
    case 'rapid': l.rapid = (l.rapid + 1) as Loadout['rapid']; break
    case 'bomb': l.bombs++; break
    case 'shield': w.ship.shield = maxShield(l); break
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
        ev.push({ kind: 'capsule', x: p.x, y: p.y, detail: applyCapsule(w, ev) })
      }
      return false
    })
  }
  w.pickups = w.pickups.filter(p => p.y < H + 10)

  if (!s.alive) return
  // Drones soak up enemy shots that touch them.
  for (let i = 0; i < w.loadout.drones; i++) {
    const d = dronePos(w, i)
    for (const b of w.enemyShots) {
      if (hit(b.x, b.y, 3, 3, d.x, d.y, 6, 6)) {
        b.y = H + 100
        ev.push({ kind: 'hit', x: d.x, y: d.y })
      }
    }
  }
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

