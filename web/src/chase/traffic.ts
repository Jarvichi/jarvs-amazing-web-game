// ─── /chase: traffic and roadside hazards ───────────────────────────────────
//
// A fixed number of civilian cars live in a window around the player. Any
// that fall far behind (or wander past the horizon) are recycled onto the
// horizon ahead, so the road always looks busy without simulating a city.

import { CAR_LEN, CAR_W, MAX_SPEED, type Player } from './car'
import { DRAW_DIST, PROP_HIT, SEG_LEN, segmentAt, splitAt, trafficX, type Prop, type Track } from './road'

export const TRAFFIC_KINDS = 5

export interface TrafficCar {
  z: number
  x: number
  lane: number
  /** Lane taken through forks (0-1 left branch, 2-3 right). */
  forkLane: number
  speed: number
  kind: number
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
  // The middle lane can go either way; the outer lanes keep to their side.
  car.forkLane = car.lane === 0 ? 0 : car.lane === 2 ? 3 : 1 + Math.floor(rnd() * 2)
  car.x = trafficX(car.lane, car.forkLane, 0)
  car.speed = MAX_SPEED * (0.35 + rnd() * 0.3)
  car.kind = Math.floor(rnd() * TRAFFIC_KINDS)
}

export function createTraffic(count: number, playerZ: number, rnd: Rng): TrafficCar[] {
  const cars: TrafficCar[] = []
  for (let i = 0; i < count; i++) {
    const car = { z: 0, x: 0, lane: 0, forkLane: 0, speed: 0, kind: 0 }
    // Spread them out ahead, leaving the start line clear.
    spawn(car, playerZ + 3000 + ((i + rnd() * 0.8) / count) * (AHEAD - 3000), rnd)
    cars.push(car)
  }
  return cars
}

/**
 * Cars in all three lanes within this distance of each other form a wall:
 * at top speed you cover about this far while changing one lane.
 */
export const WALL_GAP = 5000
/** Walls closer than this are left alone: a car pulling over under your nose would be worse. */
export const WALL_FIX_FROM = 6000
/** How far apart two cars sharing a lane must stay when one pulls over. */
const LANE_ROOM = CAR_LEN * 3

/**
 * Where a car will be when a player at top speed reaches it. Cars drift
 * together as they go, so walls are judged by these meeting points rather
 * than where the cars are now: that catches a wall while it is still forming.
 */
const meetingPoint = (c: TrafficCar, playerZ: number) =>
  playerZ + (MAX_SPEED * (c.z - playerZ)) / (MAX_SPEED - c.speed)

/**
 * Break up any wall of traffic ahead: one car in it pulls over into a lane
 * already used by another car in the wall (keeping clear of everything in
 * that lane), which leaves a lane open. On screen it just drifts across.
 */
export function openWalls(cars: TrafficCar[], playerZ: number): void {
  const ahead = cars
    .filter(c => c.z > playerZ + WALL_FIX_FROM)
    .map(c => ({ c, meet: meetingPoint(c, playerZ) }))
    .sort((a, b) => a.meet - b.meet)
  for (const first of ahead) {
    const wall = ahead.filter(a => a.meet >= first.meet && a.meet - first.meet < WALL_GAP)
    if (new Set(wall.map(a => a.c.lane)).size < 3) continue
    fix: for (const { c: mover, meet } of wall) {
      for (const lane of new Set(wall.map(a => a.c.lane))) {
        if (lane === mover.lane) continue
        const crowded = cars.some(c => c !== mover && c.lane === lane &&
          (Math.abs(c.z - mover.z) < LANE_ROOM || Math.abs(meetingPoint(c, playerZ) - meet) < LANE_ROOM))
        if (crowded) continue
        mover.lane = lane
        mover.forkLane = lane === 0 ? 0 : lane === 2 ? 3 : 1 + (mover.forkLane === 2 ? 1 : 0)
        break fix
      }
    }
  }
}

export function stepTraffic(cars: TrafficCar[], track: Track, playerZ: number, dt: number, rnd: Rng): void {
  openWalls(cars, playerZ)
  for (const car of cars) {
    car.z += car.speed * dt
    const target = trafficX(car.lane, car.forkLane, splitAt(track, car.z))
    car.x += (target - car.x) * Math.min(1, dt * 3)
    if (car.z < playerZ - BEHIND || car.z > playerZ + AHEAD + 2000) {
      spawn(car, playerZ + AHEAD * (0.75 + rnd() * 0.25), rnd)
      car.x = trafficX(car.lane, car.forkLane, splitAt(track, car.z))
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
      p.speed = car.speed * 0.85
      // Shove it well clear, so you can steer round it instead of
      // accelerating straight back into its bumper again and again.
      car.z = p.z + CAR_LEN * 4
      return 'rear'
    }
    const away = p.x < car.x ? -1 : 1
    p.x = car.x + away * CAR_W * 1.05
    p.speed *= 0.93
    return 'side'
  }
  return null
}

/** Did the player just plough into roadside scenery? */
export function hitProp(p: Player, track: Track): Prop | null {
  for (const z of [p.z, p.z + SEG_LEN]) {
    for (const prop of segmentAt(track, z).props) {
      if (Math.abs(prop.x - p.x) < PROP_HIT[prop.kind] + CAR_W / 2) return prop
    }
  }
  return null
}
