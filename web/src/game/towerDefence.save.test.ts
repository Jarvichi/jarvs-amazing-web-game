import { describe, it, expect, beforeEach, vi } from 'vitest'

// towerDefence save helpers need localStorage — stub it before importing.
let store = new Map<string, string>()
let storageThrows = false
const localStorageStub = {
  getItem: (k: string) => { if (storageThrows) throw new Error('quota'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (storageThrows) throw new Error('quota'); store.set(k, v) },
  removeItem: (k: string) => { if (storageThrows) throw new Error('quota'); store.delete(k) },
}
vi.stubGlobal('localStorage', localStorageStub)

const {
  createTDGame, placeTower, saveTDGame, loadTDSave, clearTDSave, resumeTDGame,
} = await import('./towerDefence')

import type { UnitTemplate } from './types'
import type { TDSavedPoolEntry } from './towerDefence'

const TEMPLATE: UnitTemplate = {
  name: 'Test Knight',
  attack: 10,
  maxHp: 100,
  isWall: false,
  bypassWall: false,
  moveSpeed: 50,
  attackRange: 60,
  attackCooldownMs: 1000,
}

const POOL: TDSavedPoolEntry[] = [{ template: TEMPLATE, total: 3, buildingName: 'Barracks' }]

function makeGame() {
  return createTDGame([TEMPLATE], 'city', { [TEMPLATE.name]: 3 })
}

describe('tower defence save/resume', () => {
  beforeEach(() => {
    store = new Map()
    storageThrows = false
  })

  it('round-trips an in-progress game, preserving Infinity nextWaveAt', () => {
    let game = makeGame()
    game = placeTower(game, TEMPLATE, 'Barracks', 0, 1)!
    game = { ...game, wavesCompleted: 12, currentWaveIndex: 12, mana: 345, lives: 2, phase: 'wave' }
    expect(game.nextWaveAt).toBe(Infinity)

    saveTDGame('city', game, POOL)
    const loaded = loadTDSave('city')

    expect(loaded).not.toBeNull()
    expect(loaded!.game).toEqual(game)
    expect(loaded!.game.nextWaveAt).toBe(Infinity)
    expect(loaded!.pool).toEqual(POOL)
  })

  it('round-trips a finite nextWaveAt', () => {
    const game = { ...makeGame(), phase: 'between' as const, nextWaveAt: 9876 }
    saveTDGame('city', game, POOL)
    expect(loadTDSave('city')!.game.nextWaveAt).toBe(9876)
  })

  it('keeps city and collection saves in separate slots', () => {
    saveTDGame('city', { ...makeGame(), mana: 111 }, POOL)
    saveTDGame('collection', { ...makeGame(), mana: 222 }, POOL)
    expect(loadTDSave('city')!.game.mana).toBe(111)
    expect(loadTDSave('collection')!.game.mana).toBe(222)
  })

  it('does not offer finished games for resume', () => {
    saveTDGame('city', { ...makeGame(), phase: 'victory' }, POOL)
    expect(loadTDSave('city')).toBeNull()
    saveTDGame('city', { ...makeGame(), phase: 'defeat' }, POOL)
    expect(loadTDSave('city')).toBeNull()
  })

  it('returns null for missing, corrupt, or empty-pool saves', () => {
    expect(loadTDSave('city')).toBeNull()
    store.set('jarv_td_save_city', '{not json')
    expect(loadTDSave('city')).toBeNull()
    saveTDGame('city', makeGame(), [])
    expect(loadTDSave('city')).toBeNull()
  })

  it('clearTDSave removes the save', () => {
    saveTDGame('city', { ...makeGame(), phase: 'wave' }, POOL)
    expect(loadTDSave('city')).not.toBeNull()
    clearTDSave('city')
    expect(loadTDSave('city')).toBeNull()
  })

  it('survives a throwing localStorage without crashing', () => {
    storageThrows = true
    expect(() => saveTDGame('city', makeGame(), POOL)).not.toThrow()
    expect(loadTDSave('city')).toBeNull()
    expect(() => clearTDSave('city')).not.toThrow()
  })

  it('resumeTDGame fast-forwards the ID counter past saved entities', () => {
    let game = makeGame()
    game = placeTower(game, TEMPLATE, 'Barracks', 0, 1)!
    // Simulate a save whose IDs are far ahead of the fresh counter
    const savedTower = { ...game.towers[0], id: 50 }
    const saved = { ...game, towers: [savedTower], units: game.units.map(u => ({ ...u, towerId: 50 })) }

    const resumed = resumeTDGame(saved)
    const next = placeTower(resumed, TEMPLATE, 'Barracks', 2, 1)!
    const newTower = next.towers.find(t => t.col === 2 && t.row === 1)!
    expect(newTower.id).toBeGreaterThan(50)
  })
})
