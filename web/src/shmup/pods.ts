// ─── /shmup: weapon pods ─────────────────────────────────────────────────────
//
// Maxing out a weapon mounts it on the ship as a pod and resets that weapon's
// upgrades, so the ship physically grows over a run. There is no cap: pods
// pack around the ship in hexagonal rings (6, then 12, then 18…), which keeps
// even a huge fleet inside the tunnel.
//
// A pod fires the fully-maxed version of its weapon, so mounting one never
// makes the ship weaker — the reset base weapon is climbed again on top.
// Pods can't be hit and don't block shots: the ship's hitbox never grows.

import {
  FIRE_COOLDOWN, HOMING_COOLDOWN, LASER_COOLDOWN,
  type GameEvent, type Loadout, type World,
} from './world'

export type PodKind = 'cannon' | 'homing' | 'laser' | 'side' | 'rear'

export const POD_KINDS: PodKind[] = ['cannon', 'homing', 'laser', 'side', 'rear']

/** Where each weapon's upgrades start and the level at which it becomes a pod. */
const LEVELS: Record<PodKind, { start: number; max: number }> = {
  cannon: { start: 1, max: 3 },
  homing: { start: 0, max: 2 },
  laser: { start: 0, max: 1 },
  side: { start: 0, max: 1 },
  rear: { start: 0, max: 1 },
}

export function weaponLevel(l: Loadout, k: PodKind): number {
  const v = l[k]
  return typeof v === 'boolean' ? (v ? 1 : 0) : v
}

function setWeaponLevel(l: Loadout, k: PodKind, level: number) {
  if (k === 'cannon') l.cannon = level as Loadout['cannon']
  else if (k === 'homing') l.homing = level as Loadout['homing']
  else l[k] = level > 0
}

/** Raise a weapon one level. Call `mountPods` afterwards. */
export function upgradeWeapon(l: Loadout, k: PodKind) {
  setWeaponLevel(l, k, weaponLevel(l, k) + 1)
}

/** Turn every maxed weapon into a pod and reset it. Returns the pods added. */
export function mountPods(l: Loadout): PodKind[] {
  const added: PodKind[] = []
  for (const k of POD_KINDS) {
    if (weaponLevel(l, k) >= LEVELS[k].max) {
      l.pods.push(k)
      added.push(k)
      setWeaponLevel(l, k, LEVELS[k].start)
    }
  }
  return added
}

export const podCount = (l: Loadout, k: PodKind) => l.pods.filter(p => p === k).length

export const POD_SPACING = 10

/**
 * Offset of pod `i` from the ship's centre. Ring k (from 1) has 6k slots on a
 * slightly squashed circle; within a ring, slots nearest the horizontal fill
 * first, alternating left and right, so the ship grows wings before it grows
 * a nose and tail.
 */
export function podSlot(i: number): { dx: number; dy: number } {
  let ring = 1
  let first = 0
  while (i >= first + 6 * ring) { first += 6 * ring; ring++ }
  const n = 6 * ring
  const angles = Array.from({ length: n }, (_, j) => (j / n) * Math.PI * 2)
  angles.sort((a, b) => {
    const tilt = (x: number) => Math.abs(Math.sin(x))
    return tilt(a) - tilt(b) || Math.sin(a) - Math.sin(b) || Math.cos(a) - Math.cos(b)
  })
  const a = angles[i - first]
  return { dx: Math.cos(a) * ring * POD_SPACING, dy: Math.sin(a) * ring * POD_SPACING * 0.8 }
}

export function podPos(w: World, i: number): { x: number; y: number } {
  const o = podSlot(i)
  return { x: w.ship.x + o.dx, y: w.ship.y + o.dy }
}

/** Each pod fires its weapon at full strength, on its own timer. */
export function firePods(w: World, dt: number, fire: boolean, ev: GameEvent[]) {
  const l = w.loadout
  w.podCd.length = l.pods.length
  l.pods.forEach((kind, i) => {
    w.podCd[i] = (w.podCd[i] ?? i * 0.03) - dt // staggered so pods don't fire in lockstep
    if (!fire || w.podCd[i] > 0) return
    const { x, y } = podPos(w, i)
    switch (kind) {
      case 'cannon':
        w.podCd[i] = FIRE_COOLDOWN * (1 - 0.2 * l.rapid)
        for (const [ox, vx] of [[0, 0], [-3, -60], [3, 60]]) w.shots.push({ x: x + ox, y: y - 4, vx, vy: -260, dmg: 1 })
        break
      case 'homing':
        w.podCd[i] = HOMING_COOLDOWN
        for (const side of [-1, 1]) w.shots.push({ x, y, vx: side * 60, vy: -80, dmg: 2, homing: true })
        break
      case 'laser':
        w.podCd[i] = LASER_COOLDOWN
        w.shots.push({ x, y: y - 6, vx: 0, vy: -340, dmg: 2, pierce: true })
        break
      case 'side':
        w.podCd[i] = FIRE_COOLDOWN * 2
        w.shots.push({ x: x - 4, y, vx: -220, vy: 0, dmg: 1 }, { x: x + 4, y, vx: 220, vy: 0, dmg: 1 })
        break
      case 'rear':
        w.podCd[i] = FIRE_COOLDOWN * 2
        w.shots.push({ x, y: y + 4, vx: 0, vy: 220, dmg: 1 })
        break
    }
  })
  void ev
}
