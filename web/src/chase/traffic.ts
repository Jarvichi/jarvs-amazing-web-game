// ─── /chase: traffic and roadside hazards ───────────────────────────────────
//
// A fixed number of civilian cars live in a window around the player. Any
// that fall far behind (or wander past the horizon) are recycled onto the
// horizon ahead, so the road always looks busy without simulating a city.

import { CAR_LEN, CAR_W, MAX_SPEED, type Player } from './car'
import { DRAW_DIST, SEG_LEN, laneX, segmentAt, splitAt, type PropKind, type Track } from './road'

export const TRAFFIC_KINDS = 5

export interface TrafficCar {
  z: number
  x: number
  lane: number
  speed: number
  kind: number
}

/** Collision half-widths of roadside props, in normalised x. */
export const PROP_HIT: Record<PropKind, number> = {
  palm: 0.1, lamp: 0.05, sign: 0.2, tower: 0.6, block: 0.5, cactus: 0.1, rock: 0.2,
  pine: 0.15, bush: 0.2, billboard: 0.5, chevron: 0.25, neon: 0.2,
}

const AHEAD = DRAW_DIST * SEG_LEN
const BEHIND = 4000

export type Rng = () => number

/** A seeded generator, so worlds replay identically in tests. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0x100000000
  }
}

function spawn(car: TrafficCar, z: number, rnd: Rng) {
  car.z = z
  car.lane = Math.floor(rnd() * 3)
  car.x = laneX(car.lane, 0)
  car.speed = MAX_SPEED * (0.3 + rnd() * 0.3)
  car.kind = Math.floor(rnd() * TRAFFIC_KINDS)
}

export function createTraffic(count: number, playerZ: number, rnd: Rng): TrafficCar[] {
  const cars: TrafficCar[] = []
  for (let i = 0; i < count; i++) {
    const car = { z: 0, x: 0, lane: 0, speed: 0, kind: 0 }
    // Spread them out ahead, leaving the start line clear.
    spawn(car, playerZ + 3000 + ((i + rnd() * 0.8) / count) * (AHEAD - 3000), rnd)
    cars.push(car)
  }
  return cars
}

export function stepTraffic(cars: TrafficCar[], track: Track, playerZ: number, dt: number, rnd: Rng): void {
  for (const car of cars) {
    car.z += car.speed * dt
    const target = laneX(car.lane, splitAt(track, car.z))
    car.x += (target - car.x) * Math.min(1, dt * 3)
    if (car.z < playerZ - BEHIND || car.z > playerZ + AHEAD + 2000) {
      spawn(car, playerZ + AHEAD * (0.75 + rnd() * 0.25), rnd)
      car.x = laneX(car.lane, splitAt(track, car.z))
    }
  }
}

export type Hit = 'rear' | 'side' | null

/**
 * Resolve the player running into traffic. A rear-end hit drops you to
 * below the other car's speed and shoves it ahead; a side swipe pushes you
 * apart.
 */
export function hitTraffic(p: Player, cars: TrafficCar[]): Hit {
  for (const car of cars) {
    const dz = car.z - p.z
    if (Math.abs(dz) >= CAR_LEN || Math.abs(car.x - p.x) >= CAR_W) continue
    if (dz > CAR_LEN * 0.4 && p.speed > car.speed) {
      p.speed = car.speed * 0.6
      car.z = p.z + CAR_LEN + 20
      return 'rear'
    }
    const away = p.x < car.x ? -1 : 1
    p.x = car.x + away * CAR_W * 1.05
    p.speed *= 0.85
    return 'side'
  }
  return null
}

/** Did the player just plough into roadside scenery? */
export function hitProp(p: Player, track: Track): PropKind | null {
  for (const z of [p.z, p.z + SEG_LEN]) {
    for (const prop of segmentAt(track, z).props) {
      if (Math.abs(prop.x - p.x) < PROP_HIT[prop.kind] + CAR_W / 2) return prop.kind
    }
  }
  return null
}
