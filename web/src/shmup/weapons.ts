// ─── /shmup: ship movement and weapons ──────────────────────────────────────
//
// Flying the ship, firing its loadout and moving every shot in flight.

import {
  BOMB_DAMAGE, DRONE_COOLDOWN, FIRE_COOLDOWN, H, HOMING_COOLDOWN, INVULN_TIME, LASER_COOLDOWN, MARGIN, SHIP_W, W,
  dronePos, maxShield, shipSpeed, type GameEvent, type Input, type Shot, type World,
} from './world'
import { killEnemy } from './enemies'
import { coreExposed, partPos } from './boss'

export function stepShip(w: World, input: Input, dt: number, ev: GameEvent[]) {
  const s = w.ship
  if (!s.alive) {
    s.respawn -= dt
    if (s.respawn <= 0) {
      s.alive = true
      s.x = W / 2
      s.y = H - 40
      s.shield = maxShield(w.loadout)
      s.invuln = INVULN_TIME
    }
    return
  }
  s.invuln = Math.max(0, s.invuln - dt)
  const len = Math.hypot(input.dx, input.dy) || 1
  const v = shipSpeed(w.loadout)
  s.x += (input.dx / len) * v * dt + input.dragX
  s.y += (input.dy / len) * v * dt + input.dragY
  s.x = Math.max(MARGIN + SHIP_W, Math.min(W - MARGIN - SHIP_W, s.x))
  s.y = Math.max(40, Math.min(H - 12, s.y))

  w.fireCd -= dt
  w.homingCd -= dt
  w.laserCd -= dt
  w.droneCd -= dt
  w.droneAngle += dt * 3
  if (input.bomb) detonateBomb(w, ev)
  if (!input.fire) return
  const l = w.loadout
  if (w.fireCd <= 0) {
    w.fireCd = FIRE_COOLDOWN * (1 - 0.2 * l.rapid)
    const up = (x: number, vx = 0) => w.shots.push({ x: s.x + x, y: s.y - 8, vx, vy: -260, dmg: 1 })
    if (l.cannon === 1) up(0)
    else if (l.cannon === 2) { up(-3); up(3) }
    else { up(0); up(-4, -60); up(4, 60) }
    w.sideToggle = !w.sideToggle
    if (l.side && w.sideToggle) {
      w.shots.push({ x: s.x - 6, y: s.y, vx: -220, vy: 0, dmg: 1 })
      w.shots.push({ x: s.x + 6, y: s.y, vx: 220, vy: 0, dmg: 1 })
    }
    if (l.rear && !w.sideToggle) w.shots.push({ x: s.x, y: s.y + 8, vx: 0, vy: 220, dmg: 1 })
    ev.push({ kind: 'shot', x: s.x, y: s.y })
  }
  if (l.laser && w.laserCd <= 0) {
    w.laserCd = LASER_COOLDOWN
    w.shots.push({ x: s.x, y: s.y - 10, vx: 0, vy: -340, dmg: 2, pierce: true })
  }
  if (l.drones > 0 && w.droneCd <= 0) {
    w.droneCd = DRONE_COOLDOWN
    for (let i = 0; i < l.drones; i++) {
      const d = dronePos(w, i)
      w.shots.push({ x: d.x, y: d.y - 3, vx: 0, vy: -260, dmg: 1 })
    }
  }
  if (l.homing > 0 && w.homingCd <= 0) {
    w.homingCd = HOMING_COOLDOWN
    for (let i = 0; i < l.homing; i++) {
      const side = i === 0 ? -1 : 1
      w.shots.push({ x: s.x + side * 6, y: s.y, vx: side * 60, vy: -80, dmg: 2, homing: true })
    }
  }
}

function nearestTarget(w: World, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  const consider = (tx: number, ty: number) => {
    const d = (tx - x) ** 2 + (ty - y) ** 2
    if (ty > -10 && d < bestD) { bestD = d; best = { x: tx, y: ty } }
  }
  for (const e of w.enemies) consider(e.x, e.y)
  const b = w.boss
  if (b && !b.dying) {
    for (const p of b.pods) if (p.hp > 0) { const pos = partPos(b, p); consider(pos.x, pos.y) }
    if (coreExposed(b)) consider(b.x, b.y)
  }
  return best
}

export function stepShots(w: World, dt: number) {
  for (const b of w.shots) {
    if (b.homing) {
      const t = nearestTarget(w, b.x, b.y)
      const speed = 170
      if (t) {
        const a = Math.atan2(t.y - b.y, t.x - b.x)
        b.vx += (Math.cos(a) * speed - b.vx) * Math.min(1, 6 * dt)
        b.vy += (Math.sin(a) * speed - b.vy) * Math.min(1, 6 * dt)
      } else {
        b.vy += (-speed - b.vy) * Math.min(1, 4 * dt)
      }
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  for (const b of w.enemyShots) {
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  const inside = (b: Shot) => b.x > -8 && b.x < W + 8 && b.y > -8 && b.y < H + 8
  w.shots = w.shots.filter(inside)
  w.enemyShots = w.enemyShots.filter(inside)
}


/**
 * Smart bomb: wipes every enemy shot, hurts everything on screen, and gives
 * the ship a moment's grace. It can wear a boss down but never finish off a
 * boss part — that still takes shooting.
 */
export function detonateBomb(w: World, ev: GameEvent[]) {
  const s = w.ship
  if (w.loadout.bombs <= 0 || !s.alive) return
  w.loadout.bombs--
  w.enemyShots = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    e.hp -= BOMB_DAMAGE
    e.flash = 0.2
    if (e.hp <= 0) killEnemy(w, e, ev)
  }
  const b = w.boss
  if (b && !b.dying) {
    b.lasers = []
    const parts = coreExposed(b) ? [b.core] : b.pods.filter(p => p.hp > 0)
    for (const p of parts) {
      p.hp = Math.max(1, p.hp - BOMB_DAMAGE)
      p.flash = 0.2
    }
  }
  s.invuln = Math.max(s.invuln, 1)
  ev.push({ kind: 'bomb', x: s.x, y: s.y })
}
