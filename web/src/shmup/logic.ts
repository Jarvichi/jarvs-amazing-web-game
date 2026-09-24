// ─── /shmup: pure game logic ────────────────────────────────────────────────
//
// The entry point for the vertical shooter's rules: `step` below, plus
// re-exports of the modules it drives (world, weapons, enemies, boss,
// collisions, shop). No DOM, canvas or audio, so it can be unit-tested and
// run headlessly.
// `step` advances the world one fixed tick and returns events (with positions)
// for the renderer's explosions and the sound effects to react to.
//
// Units are pixels and seconds on a 180×320 playfield, y pointing down. All
// randomness comes from the world's seeded RNG so runs are reproducible.

import { SCROLL_SPEED, type GameEvent, type Input, type World } from './world'
import { stepShip, stepShots } from './weapons'
import { stepEnemies } from './enemies'
import { spawnBoss, stepBoss } from './boss'
import { stepCollisions } from './collisions'

export * from './world'
export { ENEMIES, onScreen, rearWarnings } from './enemies'
export { coreExposed } from './boss'
export { applyCapsule } from './collisions'
export { detonateBomb } from './weapons'
export * from './shop'
export * from './pods'
export * from './difficulty'

/** Advance the world by one tick. Returns what happened this tick. */
export function step(w: World, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = []
  if (w.status !== 'playing') return ev
  w.time += dt
  if (!w.boss) w.scroll += SCROLL_SPEED * dt

  stepShip(w, input, dt, ev)
  stepEnemies(w, dt, ev)
  if (!w.boss && w.time >= w.level.bossAt && w.nextSpawn >= w.spawns.length && w.enemies.length === 0) {
    spawnBoss(w, ev)
  }
  stepBoss(w, dt, ev)
  stepShots(w, dt)
  stepCollisions(w, dt, ev)
  return ev
}

