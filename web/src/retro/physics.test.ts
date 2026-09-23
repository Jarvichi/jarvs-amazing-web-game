import { describe, it, expect } from 'vitest'
import {
  TILE, createWorld, parseLevel, step, type Input, type LevelDef, type World,
} from './physics'
import { LEVELS } from './levels'

const DT = 1 / 60
const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false }

function def(map: string[]): LevelDef {
  return { name: 'TEST', theme: 'hills', map }
}

function run(w: World, ticks: number, input: Partial<Input> = {}) {
  const events: string[] = []
  for (let i = 0; i < ticks; i++) events.push(...step(w, { ...IDLE, ...input }, DT))
  return events
}

const FLAT = def([
  '..........',
  '..........',
  '..........',
  '..........',
  '.P......F.',
  '##########',
])

describe('parseLevel', () => {
  it('rejects ragged rows and unknown tiles', () => {
    expect(() => parseLevel(def(['P.F', '##']))).toThrow(/row 1/)
    expect(() => parseLevel(def(['PXF', '###']))).toThrow(/unknown tile/)
  })

  it('requires a start and a flag', () => {
    expect(() => parseLevel(def(['..F', '###']))).toThrow(/no player start/)
    expect(() => parseLevel(def(['P..', '###']))).toThrow(/no flag/)
  })

  it('pulls coins and enemies out of the terrain', () => {
    const { level, coins, enemies } = parseLevel(def(['Poe.F', '#####']))
    expect(level.tiles[0]).toBe('.....')
    expect([...coins]).toEqual([1])
    expect(enemies).toHaveLength(1)
  })

  it.each(LEVELS.map(l => [l.name, l] as const))('%s parses', (_, l) => {
    expect(() => parseLevel(l)).not.toThrow()
  })
})

describe('player movement', () => {
  it('falls onto the ground and rests there', () => {
    const w = createWorld(FLAT)
    w.player.y -= 20
    run(w, 60)
    expect(w.player.onGround).toBe(true)
    expect(w.player.y + w.player.h).toBe(5 * TILE)
  })

  it('jumps about three tiles high with the button held', () => {
    const w = createWorld(FLAT)
    run(w, 5)
    const groundY = w.player.y
    let minY = groundY
    step(w, { ...IDLE, jump: true, jumpPressed: true }, DT)
    for (let i = 0; i < 60; i++) {
      step(w, { ...IDLE, jump: true }, DT)
      minY = Math.min(minY, w.player.y)
    }
    const height = groundY - minY
    expect(height).toBeGreaterThan(2.8 * TILE)
    expect(height).toBeLessThan(3.5 * TILE)
  })

  it('jumps lower when the button is tapped', () => {
    const w = createWorld(FLAT)
    run(w, 5)
    const groundY = w.player.y
    let minY = groundY
    step(w, { ...IDLE, jump: true, jumpPressed: true }, DT)
    for (let i = 0; i < 60; i++) {
      step(w, IDLE, DT)
      minY = Math.min(minY, w.player.y)
    }
    expect(groundY - minY).toBeLessThan(1.5 * TILE)
  })

  it('stops at walls', () => {
    const w = createWorld(def([
      '.....',
      'P.#.F',
      '#####',
    ]))
    run(w, 120, { right: true })
    expect(w.player.x + w.player.w).toBe(2 * TILE)
  })

  it('passes up through one-way platforms and lands on top of them', () => {
    const w = createWorld(def([
      '......',
      '......',
      '......',
      '.===..',
      'P....F',
      '######',
    ]))
    run(w, 5)
    step(w, { ...IDLE, right: true, jump: true, jumpPressed: true }, DT)
    run(w, 8, { right: true, jump: true })
    run(w, 60, { jump: true })
    expect(w.player.onGround).toBe(true)
    expect(w.player.y + w.player.h).toBe(3 * TILE)
  })
})

describe('hazards and goals', () => {
  it('collects coins for score', () => {
    const w = createWorld(def(['Pooo.F', '######']))
    const events = run(w, 60, { right: true })
    expect(events.filter(e => e === 'coin')).toHaveLength(3)
    expect(w.coinCount).toBe(3)
    expect(w.coins.size).toBe(0)
  })

  it('dies walking into an enemy', () => {
    const w = createWorld(def(['P...e...F', '#########']))
    const events = run(w, 120, { right: true })
    expect(events).toContain('die')
    expect(w.status).toBe('dead')
  })

  it('stomps an enemy by landing on it', () => {
    const w = createWorld(def([
      'P....',
      '.....',
      '.....',
      '.e..F',
      '#####',
    ]))
    // Drop the player straight down onto the enemy below.
    w.player.x = w.enemies[0].x + 2
    const events = run(w, 30)
    expect(events).toContain('stomp')
    expect(w.enemies[0].alive).toBe(false)
    expect(w.status).toBe('playing')
  })

  it('dies on spikes', () => {
    const w = createWorld(def(['P.^..F', '######']))
    run(w, 120, { right: true })
    expect(w.status).toBe('dead')
  })

  it('dies falling into a pit', () => {
    const w = createWorld(def(['P....F', '#..###']))
    run(w, 120, { right: true })
    expect(w.status).toBe('dead')
  })

  it('wins on reaching the flag', () => {
    const w = createWorld(FLAT)
    const events = run(w, 180, { right: true })
    expect(events).toContain('win')
    expect(w.status).toBe('won')
  })

  it('enemies turn around at ledges instead of walking off', () => {
    const w = createWorld(def([
      'P........F',
      '..........',
      '....e.....',
      '...###....',
      '##########',
    ]))
    w.level.flagX = Infinity // keep the player out of the way
    run(w, 600)
    const e = w.enemies[0]
    expect(e.alive).toBe(true)
    expect(e.y + e.h).toBe(3 * TILE)
    expect(e.x).toBeGreaterThanOrEqual(3 * TILE)
    expect(e.x + e.w).toBeLessThanOrEqual(6 * TILE)
  })
})
