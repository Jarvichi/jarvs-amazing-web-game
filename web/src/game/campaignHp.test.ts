/**
 * Coverage for the campaign HP-carry-forward bug (max HP display drifting from
 * in-battle HP when a relic with a flat HP bonus is equipped) and the
 * surrounding HP-persistence surface: permanent stat upgrades, relic
 * equip/swap/break, node-map events, rest-node overheal, and archetype
 * selection (which should have no effect on base HP at all).
 *
 * sound.ts and debug.ts are stubbed so engine.ts's newGame() runs in Node
 * without a DOM (same pattern as engine.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./sound', () => ({
  playUnitDeath: vi.fn(),
  playBuildingDestroyed: vi.fn(),
  playCardPlay: vi.fn(),
  playUpgrade: vi.fn(),
  playBaseHit: vi.fn(),
  playVictory: vi.fn(),
  playDefeat: vi.fn(),
}))

vi.mock('./debug', () => ({
  isNoDamageMode: () => false,
}))

// Minimal in-memory localStorage for the Node test environment.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => storage.get(k) ?? null,
  setItem:    (k: string, v: string) => { storage.set(k, String(v)) },
  removeItem: (k: string) => { storage.delete(k) },
  clear:      () => { storage.clear() },
})

import { newGame, tick } from './engine'
import type { GameState, Archetype } from './types'
import { syncPlayerCommanderToBase } from './engine/helpers'
import { newRun, type RunState } from './questline'
import { loadPlayerStats, savePlayerStats, applyStatUpgrade, type PlayerStats } from './playerStats'
import { getRelicDef } from './relics'
import { carryHpAfterBattle, applyRestHeal, applyEventHeal } from './campaignHelpers'

beforeEach(() => storage.clear())

const DEFAULT_STATS: PlayerStats = {
  maxHp: 50, maxMana: 5, maxDeckSize: 30, maxLives: 3, manaRegenMs: 3000,
}

/** Builds a battle GameState the way App.tsx does when entering a campaign node. */
function enterBattle(run: RunState): GameState {
  const state = newGame()
  state.playerBase = { hp: run.playerHp, maxHp: run.maxHp }
  if (run.activeRelic) getRelicDef(run.activeRelic)?.applyToGame(state)
  // The player commander unit is the base avatar; the engine syncs its hp into
  // playerBase.hp every tick, so App.tsx reconciles it after relic setup.
  syncPlayerCommanderToBase(state)
  if (run.archetype) state.archetypePassive = run.archetype
  return state
}

/** Simulates a battle ending with `damage` taken off the (possibly relic-inflated) pool, then carries HP back into the run — mirrors handleCampaignWin. */
function winBattle(run: RunState, state: GameState, damage: number): RunState {
  state.playerBase.hp = Math.max(0, state.playerBase.hp - damage)
  return { ...run, playerHp: carryHpAfterBattle(run.maxHp, state.playerBase) }
}

// ─── Permanent stat upgrades → new runs ────────────────────────────────────

describe('permanent maxHp upgrades feed into newRun()', () => {
  it('a fresh run starts at full health, matching the current pStats.maxHp', () => {
    savePlayerStats({ ...DEFAULT_STATS })
    const run = newRun('act1')
    expect(run.maxHp).toBe(50)
    expect(run.playerHp).toBe(50)
  })

  it('three completed-campaign upgrades (+10 each) raise a subsequent run to 80', () => {
    savePlayerStats({ ...DEFAULT_STATS })
    applyStatUpgrade('maxHp')
    applyStatUpgrade('maxHp')
    applyStatUpgrade('maxHp')
    expect(loadPlayerStats().maxHp).toBe(80)

    const run = newRun('act1')
    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(80)
  })
})

// ─── The reported scenario: 80 max HP + Worldmender's Crest ────────────────

describe('80 max HP + Worldmender’s Crest at battle start', () => {
  it('goes into battle at full 80 current HP, with a 110 relic-inflated ceiling', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    const state = enterBattle(run)

    // Worldmender's Crest adds +30 base HP — applied to both hp and maxHp so a
    // fresh, undamaged run enters battle at full health on the new ceiling.
    expect(state.playerBase.maxHp).toBe(110)
    expect(state.playerBase.hp).toBe(110)
    // The player's actual current HP going in (relative to their real 80 max) is
    // the full 80 — never something lower, regardless of the relic.
    expect(state.playerBase.hp - (state.playerBase.maxHp - run.maxHp)).toBe(80)
  })
})

// ─── The HP bar after the game loop runs (regression for the 58/80 bug) ────
//
// The player "base" on the battlefield is a commander unit in state.field, and
// every engine tick syncs commander.hp → playerBase.hp. newGame() spawns that
// commander at a fixed HP, so unless battle setup reconciles it with the run's
// max HP (+ relic baseHp), the first tick drags the current-HP bar down to the
// commander's stale value. These tests run a tick so that sync actually fires —
// the earlier assertions read playerBase before any tick and so missed the bug.

describe('current-HP bar stays correct after the first engine tick', () => {
  it('50 base HP + Worldmender’s Crest enters battle at 80/80, not 58/80', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 50 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    let state = enterBattle(run)
    // Advance one game loop so the commander → playerBase.hp sync runs.
    state = tick(state, 16)

    // Base = 50 + 30 (relic baseHp); the +8 unit HP must NOT leak onto the base.
    expect(state.playerBase.maxHp).toBe(80)
    expect(state.playerBase.hp).toBe(80)
  })

  it('a permanent maxHp upgrade to 80 (no relic) enters battle at 80/80, not 50/80', () => {
    savePlayerStats({ ...DEFAULT_STATS })
    applyStatUpgrade('maxHp')
    applyStatUpgrade('maxHp')
    applyStatUpgrade('maxHp')
    const run = newRun('act1')
    expect(run.maxHp).toBe(80)

    let state = enterBattle(run)
    state = tick(state, 16)

    // The upgraded max HP must reach the commander so it grants real survivability.
    expect(state.playerBase.maxHp).toBe(80)
    expect(state.playerBase.hp).toBe(80)
  })

  it('a partially-damaged run + Crest correctly shows the damaged total, not full', () => {
    // run at 28/50 (22 damage taken previously) re-entering with the Crest should
    // read 58/80 — that value is only wrong when the player is actually at full HP.
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 50 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest", playerHp: 28 }

    let state = enterBattle(run)
    state = tick(state, 16)

    expect(state.playerBase.maxHp).toBe(80)
    expect(state.playerBase.hp).toBe(58)
  })
})

// ─── Regression: relic bonus must not leak into persisted run HP ──────────

describe('carryHpAfterBattle — relic HP bonus never leaks into run.maxHp', () => {
  it('with no relic, HP carries forward as plain damage taken', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')

    const state = enterBattle(run)
    run = winBattle(run, state, 22)

    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(58)
  })

  it('with Worldmender’s Crest equipped, run.maxHp never drifts across many battles', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    // Fight five battles in a row, taking damage each time, without ever
    // reloading from localStorage (the only place the old code's drift got
    // silently papered over). run.maxHp must stay exactly 80 throughout, and
    // the displayed current HP must always be <= 80.
    const damagePerBattle = [10, 15, 5, 20, 8]
    for (const dmg of damagePerBattle) {
      const state = enterBattle(run)
      // Confirm the relic really did cushion this battle before applying damage.
      expect(state.playerBase.maxHp).toBe(run.maxHp + 30)
      run = winBattle(run, state, dmg)
      expect(run.maxHp).toBe(80)
      expect(run.playerHp).toBeLessThanOrEqual(80)
    }

    const totalDamage = damagePerBattle.reduce((a, b) => a + b, 0)
    expect(run.playerHp).toBe(80 - totalDamage)
  })

  it('a full-health battle with the relic leaves the run at full health, not reduced', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    const state = enterBattle(run)
    // No damage taken this battle.
    run = winBattle(run, state, 0)

    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(80)
  })
})

// ─── Relic swapped or broken mid-run ───────────────────────────────────────

describe('relic swap / break between battles', () => {
  it('swapping to a different relic does not carry over the old relic’s HP bonus', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    // Battle 1: take some damage under Worldmender's Crest (+30 base HP).
    let state = enterBattle(run)
    run = winBattle(run, state, 25)
    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(55)

    // Swap to Bark Shield (+10 base HP) between battles — as happens at act-end
    // relic selection.
    run = { ...run, activeRelic: 'Bark Shield' }
    state = enterBattle(run)
    expect(state.playerBase.maxHp).toBe(90) // 80 + 10, not 80 + 30 + 10
    expect(state.playerBase.hp).toBe(65)    // 55 + 10, not 55 + 30 + 10

    run = winBattle(run, state, 0)
    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(55) // unchanged — no damage this battle
  })

  it('breaking/unequipping a relic entirely drops its bonus cleanly', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    let state = enterBattle(run)
    run = winBattle(run, state, 10)
    expect(run.playerHp).toBe(70)

    // Relic breaks — no longer equipped.
    run = { ...run, activeRelic: null }
    state = enterBattle(run)
    expect(state.playerBase.maxHp).toBe(80) // no relic bonus at all
    expect(state.playerBase.hp).toBe(70)

    run = winBattle(run, state, 15)
    expect(run.maxHp).toBe(80)
    expect(run.playerHp).toBe(55)
  })
})

// ─── Archetype has no effect on base HP ────────────────────────────────────

describe('archetype/subclass selection does not affect base HP', () => {
  const archetypes: Archetype[] = ['siege_commander', 'swarm_tactician', 'arcane_scholar']

  it.each(archetypes)('%s leaves playerBase hp/maxHp identical to no archetype', (archetype) => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    const baseRun = newRun('act1')

    const withoutArchetype = enterBattle(baseRun)
    const withArchetype = enterBattle({ ...baseRun, archetype })

    expect(withArchetype.playerBase.hp).toBe(withoutArchetype.playerBase.hp)
    expect(withArchetype.playerBase.maxHp).toBe(withoutArchetype.playerBase.maxHp)
  })
})

// ─── Node-map events: healHp clamps, rest-node heal can overheal ──────────

describe('applyEventHeal — node-map event healHp effect', () => {
  it('clamps to maxHp — events never grant an overheal', () => {
    expect(applyEventHeal(70, 80, 25)).toBe(80)
  })

  it('does not clamp below the target when already under max', () => {
    expect(applyEventHeal(50, 80, 10)).toBe(60)
  })

  it('a full-health player gains nothing from an event heal (unlike the rest-node choice)', () => {
    expect(applyEventHeal(80, 80, 15)).toBe(80)
  })
})

describe('applyRestHeal — rest-node heal choice', () => {
  it('clamps a normal heal to maxHp', () => {
    const result = applyRestHeal(70, 80, 15)
    expect(result.hp).toBe(80)
    expect(result.message).toContain('Healed 10 HP')
  })

  it('grants bonus HP above maxHp when already at full health', () => {
    const result = applyRestHeal(80, 80, 5)
    expect(result.hp).toBe(85)
    expect(result.message).toContain('bonus HP above your maximum')
  })

  it('an overheal carries forward correctly on the player’s next battle', () => {
    savePlayerStats({ ...DEFAULT_STATS, maxHp: 80 })
    let run = newRun('act1')
    run = { ...run, activeRelic: "Worldmender's Crest" }

    const healed = applyRestHeal(run.playerHp, run.maxHp, 5)
    run = { ...run, playerHp: healed.hp }
    expect(run.playerHp).toBe(85) // 5 HP above the 80 max

    // Entering battle: the relic adds its +30 to both hp and maxHp, so the
    // overheal buffer is preserved relative to the new ceiling too.
    const state = enterBattle(run)
    expect(state.playerBase.maxHp).toBe(110)
    expect(state.playerBase.hp).toBe(115)

    // Ending the battle undamaged carries the overheal back through untouched.
    run = winBattle(run, state, 0)
    expect(run.playerHp).toBe(85)
    expect(run.maxHp).toBe(80)
  })
})
