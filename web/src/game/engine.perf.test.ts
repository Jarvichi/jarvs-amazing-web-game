/**
 * Engine tick performance threshold tests.
 *
 * These run in CI (node environment, no browser required) and will fail if a
 * code change causes a significant throughput regression — e.g. re-introducing
 * structuredClone, an accidentally O(n²) loop, or unbounded array growth.
 *
 * Thresholds are intentionally generous to survive slow CI runners (GitHub
 * Actions is roughly 3–5× slower than a modern dev machine). They are set at
 * roughly 3× the expected runtime after the current optimisations, so they
 * catch regressions without false-positives from hardware variance.
 */

import { describe, it, expect } from 'vitest'
import { newGame, tick } from './engine'
import { spawnUnit } from './engine/helpers'

const TICK_MS = 100

/** Build a realistic heavy battlefield: 40 mobile units + 8 structures + blood pools. */
function createHeavyState() {
  const state = newGame()

  const mobileTemplate = {
    name: 'Goblin',
    maxHp: 25, attack: 6,
    moveSpeed: 32, attackRange: 35, attackCooldownMs: 1000,
    isWall: false, bypassWall: false,
  }
  const rangedTemplate = {
    name: 'Archer',
    maxHp: 18, attack: 8,
    moveSpeed: 28, attackRange: 90, attackCooldownMs: 1200,
    isWall: false, bypassWall: true,
  }
  const structureTemplate = {
    name: 'Tower',
    maxHp: 60, attack: 10,
    moveSpeed: 0, attackRange: 90, attackCooldownMs: 1500,
    isWall: false, bypassWall: true,
  }

  for (let i = 0; i < 15; i++) {
    state.field.push(spawnUnit(mobileTemplate, 'player'))
    state.field.push(spawnUnit(mobileTemplate, 'opponent'))
  }
  for (let i = 0; i < 5; i++) {
    state.field.push(spawnUnit(rangedTemplate, 'player'))
    state.field.push(spawnUnit(rangedTemplate, 'opponent'))
  }
  for (let i = 0; i < 4; i++) {
    state.field.push(spawnUnit(structureTemplate, i % 2 === 0 ? 'player' : 'opponent'))
  }

  // Blood pools scattered across the field to exercise pool-avoidance code
  for (let i = 0; i < 12; i++) {
    state.bloodPools.push({
      id: `pool-${i}`,
      x: 60 + i * 30,
      y: ((i % 5) - 2) * 18,
    })
  }

  return state
}

describe('engine tick performance', () => {
  it('completes 300 ticks with 40+ units in under 5 seconds', () => {
    let state = createHeavyState()

    const start = performance.now()
    for (let i = 0; i < 300; i++) {
      state = tick(state, TICK_MS)
      if (state.phase.type !== 'playing') break
    }
    const elapsed = performance.now() - start

    // Threshold set to catch a structuredClone regression (~15–50 ms per tick added)
    // while remaining stable on slow CI hardware.
    expect(
      elapsed,
      `300 ticks took ${elapsed.toFixed(0)} ms — expected < 5000 ms. ` +
      'A regression likely re-introduced a deep-clone or O(n²) loop.',
    ).toBeLessThan(5000)
  })

  it('runs a minimal 5-unit battle 1000 ticks without crashing', () => {
    let state = newGame()
    for (let i = 0; i < 1000; i++) {
      state = tick(state, TICK_MS)
      if (state.phase.type !== 'playing') break
    }
    // Reaching here without throwing is the pass condition
    expect(state).toBeDefined()
  })
})
