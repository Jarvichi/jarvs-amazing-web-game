// ─── /shmup: bosses ─────────────────────────────────────────────────────────
//
// Boss entry, movement, attacks and damage. The core is armoured until every
// pod is destroyed.

import {
  BOSS_CREDITS, BULLET_DAMAGE, W, hit, rand, type Boss, type BossPart, type GameEvent, type World,
} from './world'
import { aimAt } from './enemies'

export function spawnBoss(w: World, ev: GameEvent[]) {
  const d = w.level.boss
  const part = (ox: number, oy: number, hp: number, pw: number, ph: number): BossPart =>
    ({ ox, oy, hp, max: hp, w: pw, h: ph, fire: 1 + rand(w), flash: 0 })
  w.boss = {
    def: d,
    x: W / 2,
    y: -50,
    t: 0,
    core: part(0, 0, d.coreHp, 36, 24),
    pods: d.pods.map(p => part(p.ox, p.oy, d.podHp, 14, 14)),
    dying: 0,
  }
  ev.push({ kind: 'boss', x: W / 2, y: 0 })
}

export function coreExposed(b: Boss): boolean {
  return b.pods.every(p => p.hp <= 0)
}

export function stepBoss(w: World, dt: number, ev: GameEvent[]) {
  const b = w.boss
  if (!b) return
  b.t += dt
  if (b.dying > 0) {
    b.dying += dt
    if (Math.floor(b.dying * 8) !== Math.floor((b.dying - dt) * 8)) {
      ev.push({ kind: 'explode', x: b.x + (rand(w) - 0.5) * 60, y: b.y + (rand(w) - 0.5) * 36 })
    }
    if (b.dying > 2.5) w.status = 'won'
    return
  }

  // Enter, then sway across the top of the screen.
  if (b.y < 64) b.y += 30 * dt
  else b.x = W / 2 + Math.sin(b.t * b.def.sway) * 36

  const exposed = coreExposed(b)
  for (const p of b.pods) {
    p.flash = Math.max(0, p.flash - dt)
    if (p.hp > 0 && b.y >= 64 && (p.fire -= dt) <= 0) {
      p.fire = 1.3
      aimAt(w, b.x + p.ox, b.y + p.oy, 100)
    }
  }
  const c = b.core
  c.flash = Math.max(0, c.flash - dt)
  if (b.y >= 64 && (c.fire -= dt) <= 0) {
    c.fire = exposed ? 1.4 : 2.6
    const n = b.def.spread + (exposed ? 2 : 0)
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22
      w.enemyShots.push({ x: b.x, y: b.y + 12, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, dmg: BULLET_DAMAGE })
    }
  }

  for (const s of w.shots) {
    for (const p of [...b.pods, c]) {
      if (p.hp <= 0) continue
      if (!hit(s.x, s.y, 3, 6, b.x + p.ox, b.y + p.oy, p.w, p.h)) continue
      const hy = s.y
      s.y = -100 // spent
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
          ev.push({ kind: 'podkill', x: b.x + p.ox, y: b.y + p.oy })
        }
      }
      break
    }
  }
}

