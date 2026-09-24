// ─── /shmup: difficulty that keeps up with the ship ─────────────────────────
//
// Pods are uncapped, so a strong run can carry many times the firepower a
// level was tuned for, and enemies stop mattering. Each level therefore has
// an expected loadout, and enemy (and boss) health scales with how far the
// ship's firepower is above it. Only part of the surplus is absorbed
// (ABSORB), so upgrades still feel like upgrades; a ship at or below the
// expected power sees the level exactly as designed.

import {
  DRONE_COOLDOWN, FIRE_COOLDOWN, HOMING_COOLDOWN, LASER_COOLDOWN, START_LOADOUT,
  cloneLoadout, type Loadout,
} from './world'

/** Share of firepower above the level's expectation that enemy health cancels out. */
export const ABSORB = 0.6

/**
 * What a player could plausibly be flying at each tier, given what earlier
 * levels pay. Also what the headless completion test flies.
 */
export const EXPECTED_LOADOUT: Partial<Loadout>[] = [
  {},
  { cannon: 2 },
  { cannon: 2, rapid: 1, pods: ['side'] },
  { cannon: 2, rapid: 1, homing: 1, drones: 1, pods: ['cannon', 'side'] },
  { cannon: 2, rapid: 2, homing: 1, drones: 1, pods: ['cannon', 'side', 'laser', 'rear'] },
]

export function expectedLoadout(tier: number): Loadout {
  const over = EXPECTED_LOADOUT[Math.min(EXPECTED_LOADOUT.length, Math.max(1, tier)) - 1]
  return { ...cloneLoadout(START_LOADOUT), ...over, pods: [...(over.pods ?? [])] }
}

/**
 * Rough damage per second into whatever is in front of the ship. Side and
 * rear fire count for a little: they rarely hit what matters.
 */
export function firepower(l: Loadout): number {
  const cannonRate = 1 / (FIRE_COOLDOWN * (1 - 0.2 * l.rapid))
  let dps = l.cannon * cannonRate
  dps += (2 * l.homing) / HOMING_COOLDOWN
  dps += l.drones / DRONE_COOLDOWN
  if (l.laser) dps += 2 / LASER_COOLDOWN
  for (const p of l.pods) {
    if (p === 'cannon') dps += 3 * cannonRate
    else if (p === 'homing') dps += 4 / HOMING_COOLDOWN
    else if (p === 'laser') dps += 2 / LASER_COOLDOWN
    else dps += 0.25 / (FIRE_COOLDOWN * 2) // side / rear
  }
  return dps
}

/** Health multiplier for enemies at this tier against this loadout (≥ 1). */
export function powerScale(l: Loadout, tier: number): number {
  const surplus = firepower(l) / firepower(expectedLoadout(tier)) - 1
  return 1 + ABSORB * Math.max(0, surplus)
}
