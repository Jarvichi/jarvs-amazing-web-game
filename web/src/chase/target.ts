// ─── /chase: the target car ─────────────────────────────────────────────────
//
// The car you are after cruises a little slower than your top speed, weaves
// between lanes to get round traffic, and takes its chosen branch at every
// fork. Once you are on its tail it fights: it dodges away from you, and
// each ram adds damage until it gives up and pulls over.

import { CAR_LEN, CAR_W, MAX_SPEED, type Player } from './car'
import { FORK_OPEN, SEG_LEN, laneX, segmentAt, splitAt, type Track } from './road'
import type { Rng, TrafficCar } from './traffic'

export interface Target {
  z: number
  x: number
  lane: number
  speed: number
  /** 0 … 1; at 1 it gives up. */
  damage: number
  /** Seconds until it next considers changing lane. */
  think: number
  stopping: boolean
  /** Cooldown so one collision is not counted as several rams. */
  ramCool: number
}

export function createTarget(z: number): Target {
  return { z, x: 0, lane: 1, speed: 0, damage: 0, think: 1, stopping: false, ramCool: 0 }
}

/** Which branch must a car at `z` be heading for? Null if no fork is near. */
function forkSide(track: Track, z: number): 'left' | 'right' | null {
  const here = segmentAt(track, z)
  if (here.forkId >= 0) return track.forks[here.forkId].side
  const ahead = segmentAt(track, z + FORK_OPEN * SEG_LEN)
  return ahead.forkId >= 0 ? track.forks[ahead.forkId].side : null
}

/** How clear is `lane` for the next stretch of road? Bigger is better. */
function laneGap(lane: number, z: number, traffic: TrafficCar[]): number {
  let gap = 4000
  for (const c of traffic) if (c.lane === lane && c.z > z && c.z - z < gap) gap = c.z - z
  return gap
}

export interface TargetContext {
  track: Track
  traffic: TrafficCar[]
  player: Player
  /** Cruising speed for this case. */
  cruise: number
  /** In the arrest phase the target fights back and waits for you. */
  arrest: boolean
  rnd: Rng
}

export function stepTarget(t: Target, ctx: TargetContext, dt: number): void {
  const { track, traffic, player, arrest, rnd } = ctx
  t.ramCool = Math.max(0, t.ramCool - dt)

  if (t.stopping) {
    t.speed = Math.max(0, t.speed - MAX_SPEED * 0.5 * dt)
    t.x += (1.3 - t.x) * Math.min(1, dt * 1.5)
    t.z += t.speed * dt
    return
  }

  // Speed: cruise, but in the arrest phase don't run away for good — a
  // battered car slows, and one far ahead eases off so you can close in.
  let want = ctx.cruise * (1 - t.damage * 0.12)
  if (arrest && t.z - player.z > 4000) want *= 0.85
  // Overtaken? Floor it and get back in front.
  if (t.z < player.z - CAR_LEN) want = Math.max(want, player.speed + MAX_SPEED * 0.15)
  t.speed += Math.sign(want - t.speed) * Math.min(Math.abs(want - t.speed), MAX_SPEED * 0.5 * dt)

  // Lanes: forks decide for it; otherwise it picks the clearest lane, and
  // dodges away from you when you get close.
  const side = forkSide(track, t.z)
  if (side) {
    const ok = side === 'right' ? [2] : [0, 1]
    if (!ok.includes(t.lane)) t.lane = side === 'right' ? 2 : 1
  } else {
    t.think -= dt
    const close = arrest && Math.abs(t.z - player.z) < CAR_LEN * 3
    if (t.think <= 0) {
      t.think = (close ? 1 : 0.8) + rnd() * 1.5 - t.damage * 0.5
      const options = [0, 1, 2].filter(l => Math.abs(l - t.lane) <= 1)
      let best = t.lane
      let score = -Infinity
      for (const l of options) {
        let s = laneGap(l, t.z, traffic) + rnd() * 600
        if (close) s += Math.abs(laneX(l, 0) - player.x) * 3000
        if (s > score) { score = s; best = l }
      }
      t.lane = best
    }
  }
  const aim = laneX(t.lane, splitAt(track, t.z))
  t.x += (aim - t.x) * Math.min(1, dt * (2 + t.damage * 2))
  t.z += t.speed * dt
}

/** Damage from ramming the target at `closing` speed (world units/s). */
export function ramDamage(closing: number, turbo: boolean, armour: number, side: boolean): number {
  const base = side ? 0.035 : Math.min(0.16, 0.05 + (Math.max(0, closing) / MAX_SPEED) * 0.35)
  return base * armour * (turbo ? 2 : 1)
}

export type Ram = { damage: number; side: boolean } | null

/**
 * Resolve the player hitting the target. Returns the damage dealt, or null
 * if they are not touching (or it is too soon after the last ram).
 */
export function ramTarget(t: Target, p: Player, armour: number): Ram {
  if (t.stopping || t.ramCool > 0) return null
  const dz = t.z - p.z
  if (Math.abs(dz) >= CAR_LEN || Math.abs(t.x - p.x) >= CAR_W * 1.1) return null
  const side = dz < CAR_LEN * 0.5
  const damage = ramDamage(p.speed - t.speed, p.turbo > 0, armour, side)
  t.damage = Math.min(1, t.damage + damage)
  t.ramCool = 0.35
  if (side) {
    const away = t.x < p.x ? -1 : 1
    t.x += away * 0.25
    p.x -= away * 0.2
  } else {
    p.speed = t.speed * 0.8
    t.z = p.z + CAR_LEN + 10
  }
  // Knock it off its line.
  t.think = 0
  if (t.damage >= 1) t.stopping = true
  return { damage, side }
}
