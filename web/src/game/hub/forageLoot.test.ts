import { describe, it, expect } from 'vitest'
import { forageTable, rollForage } from './forageLoot'
import { getHubItemCatalogEntry } from '../itemStore'
import FORAGE_LOOT from '../../data/hub/forageLoot.json'

describe('forage loot tables', () => {
  it('falls back to the hedgerow table for an unknown or missing id', () => {
    expect(forageTable(undefined)).toBe(forageTable('wild'))
    expect(forageTable('not-a-table')).toBe(forageTable('wild'))
  })

  it('every table has a prompt, a confirm label and weighted entries', () => {
    for (const [id, table] of Object.entries(FORAGE_LOOT)) {
      expect(table.prompt, id).toBeTruthy()
      expect(table.confirmLabel, id).toBeTruthy()
      expect(table.entries.length, id).toBeGreaterThan(0)
      for (const entry of table.entries) {
        expect(entry.weight, id).toBeGreaterThan(0)
        expect(entry.text, id).toBeTruthy()
      }
    }
  })

  it('every hub-item a table can grant exists in the catalog', () => {
    for (const [id, table] of Object.entries(FORAGE_LOOT)) {
      for (const entry of table.entries) {
        if (!('hubItemId' in entry) || !entry.hubItemId) continue
        expect(getHubItemCatalogEntry(entry.hubItemId), `${id}: ${entry.hubItemId}`).toBeTruthy()
      }
    }
  })

  it('the fruit table drops apples, pears and cherries', () => {
    const fruit = forageTable('fruit')
    const ids = fruit.entries.map(e => e.hubItemId).filter(Boolean)
    expect(ids).toEqual(expect.arrayContaining(['apple', 'pear', 'cherries']))
  })
})

describe('rollForage', () => {
  const first = { random: () => 0 }
  const last = { random: () => 0.999999 }

  it('draws the first entry at the bottom of the range and the last at the top', () => {
    const table = forageTable('fruit')
    expect(rollForage(table, first).hubItemId).toBe(table.entries[0].hubItemId)
    expect(rollForage(table, last).collectible?.id).toBe('four-leaf-clover')
  })

  it('always yields a log from the single-entry wood table', () => {
    expect(rollForage(forageTable('wood'), first).hubItemId).toBe('log')
    expect(rollForage(forageTable('wood'), last).hubItemId).toBe('log')
  })

  it('rolls crystals inside the authored range and fills them into the line', () => {
    // 0.5 lands on the crystal entry of the hedgerow table (45/35/20).
    const outcome = rollForage(forageTable('wild'), { random: () => 0.5 })
    expect(outcome.crystals).toBeGreaterThanOrEqual(5)
    expect(outcome.crystals).toBeLessThanOrEqual(15)
    expect(outcome.text).toContain(String(outcome.crystals))
    expect(outcome.text).not.toContain('{crystals}')
  })

  it('swaps in a spot\'s own fruit, leaving non-item outcomes alone', () => {
    const table = forageTable('fruit')
    const picked = rollForage(table, { ...first, overrideItemId: 'crab-apple' })
    expect(picked.hubItemId).toBe('crab-apple')
    expect(picked.text).toContain('Crab Apple')

    const clover = rollForage(table, { ...last, overrideItemId: 'crab-apple' })
    expect(clover.hubItemId).toBeUndefined()
    expect(clover.collectible?.id).toBe('four-leaf-clover')
  })

  it('uses a spot\'s own line when it has one', () => {
    const outcome = rollForage(forageTable('fruit'), {
      ...first, overrideItemId: 'crab-apple', overrideText: 'A hard little crab apple. 🍏',
    })
    expect(outcome.text).toBe('A hard little crab apple. 🍏')
  })

  it('leaves the authored line alone when a spot pins the same item the entry already grants', () => {
    const outcome = rollForage(forageTable('fruit'), { ...first, overrideItemId: 'apple' })
    expect(outcome.hubItemId).toBe('apple')
    expect(outcome.text).toBe(forageTable('fruit').entries[0].text)
  })
})
