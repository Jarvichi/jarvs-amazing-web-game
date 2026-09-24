// ─── /chase: the player's pursuit car ───────────────────────────────────────
//
// Arcade handling: steering moves you sideways faster the faster you go, and
// curves push you outward in proportion to speed² — so at top speed the
// sharpest bends need a touch of brake, and on turbo even medium ones do.
// Leaving the tarmac drags you down to a crawl.

import { SEG_LEN, onRoad } from './road'

export const MAX_SPEED = SEG_LEN * 60
export const TURBO_SPEED = MAX_SPEED * 1.35
export const ACCEL = MAX_SPEED / 4
export const TURBO_ACCEL = MAX_SPEED * 1.2
export const BRAKE = MAX_SPEED * 1.1
export const DECEL = MAX_SPEED / 5
export const OFFROAD_LIMIT = MAX_SPEED / 3
export const OFFROAD_DECEL = MAX_SPEED
export const CENTRIFUGAL = 0.15
export const TURBO_TIME = 3
export const TURBOS = 3
/** Furthest the car can wander from the middle of the road. */
export const MAX_X = 3

/** A car's size: length along the road (world units), width (normalised x). */
export const CAR_LEN = 420
export const CAR_W = 0.3

/** Speedometer reading at MAX_SPEED. */
export const KMH_AT_MAX = 250
export const kmh = (speed: number) => Math.round((speed / MAX_SPEED) * KMH_AT_MAX)

export interface Player {
  x: number
  z: number
  speed: number
  /** Seconds of turbo left (0 = off). */
  turbo: number
  turbos: number
}

export interface Controls {
  /** -1 left … +1 right. */
  steer: number
  gas: boolean
  brake: boolean
  /** Turbo button went down this tick. */
  turbo: boolean
}

export const IDLE: Controls = { steer: 0, gas: false, brake: false, turbo: false }

export function createPlayer(z = 0): Player {
  return { x: 0, z, speed: 0, turbo: 0, turbos: TURBOS }
}

/**
 * Advance the car one tick along a segment with the given curve and fork
 * split. Returns 'turbo' if a turbo fired this tick.
 */
export function stepPlayer(p: Player, c: Controls, curve: number, split: number, dt: number): 'turbo' | null {
  let fired: 'turbo' | null = null
  if (c.turbo && p.turbos > 0 && p.turbo <= 0) {
    p.turbos--
    p.turbo = TURBO_TIME
    fired = 'turbo'
  }
  if (p.turbo > 0) p.turbo = Math.max(0, p.turbo - dt)

  const top = p.turbo > 0 ? TURBO_SPEED : MAX_SPEED
  const before = p.speed
  if (c.brake) p.speed -= BRAKE * dt
  else if (p.turbo > 0) p.speed += TURBO_ACCEL * dt
  else if (c.gas) p.speed += ACCEL * dt
  else p.speed -= DECEL * dt
  // Accelerating stops at top speed; coming off a turbo eases back down to it.
  if (p.speed > top) p.speed = before > top ? Math.max(top, before - DECEL * 2 * dt) : top
  if (!onRoad(p.x, split) && p.speed > OFFROAD_LIMIT) p.speed = Math.max(OFFROAD_LIMIT, p.speed - OFFROAD_DECEL * dt)
  p.speed = Math.max(0, p.speed)

  const sp = p.speed / MAX_SPEED
  const dx = dt * 2 * sp
  p.x += Math.max(-1, Math.min(1, c.steer)) * dx
  p.x -= dx * sp * curve * CENTRIFUGAL
  p.x = Math.max(-MAX_X, Math.min(MAX_X, p.x))
  p.z += p.speed * dt
  return fired
}

/** Do two cars overlap? */
export const overlaps = (z1: number, x1: number, z2: number, x2: number) =>
  Math.abs(z1 - z2) < CAR_LEN && Math.abs(x1 - x2) < CAR_W
