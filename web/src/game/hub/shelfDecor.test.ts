import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  shelfItemDisplayId, shelfRelicDisplayId, isShelfDecorId, getShelfDecorDef, ownsShelfDecor,
} from './shelfDecor'
import { addToInventory } from '../dailyLogin'
import { addEarnedRelic } from '../relics'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('shelfDecor', () => {
  beforeEach(() => { installLocalStorageStub() })

  it('recognizes shelf-item and shelf-relic ids', () => {
    expect(isShelfDecorId(shelfItemDisplayId('foo'))).toBe(true)
    expect(isShelfDecorId(shelfRelicDisplayId('Foo Relic'))).toBe(true)
    expect(isShelfDecorId('reading-lamp')).toBe(false)
  })

  it('resolves a keepsake/junk item that is in the inventory', () => {
    addToInventory({ id: 'trinket-1', name: 'Old Trinket', icon: '🔮', desc: '', lore: '', isKeepsake: true })
    const id = shelfItemDisplayId('trinket-1')
    expect(getShelfDecorDef(id)).toEqual({ id, name: 'Old Trinket', icon: '🔮' })
    expect(ownsShelfDecor(id)).toBe(true)
  })

  it('returns undefined for an item id no longer in the inventory', () => {
    const id = shelfItemDisplayId('never-owned')
    expect(getShelfDecorDef(id)).toBeUndefined()
    expect(ownsShelfDecor(id)).toBe(false)
  })

  it('resolves an earned relic', () => {
    addEarnedRelic('Bark Shield')
    const id = shelfRelicDisplayId('Bark Shield')
    const def = getShelfDecorDef(id)
    expect(def?.id).toBe(id)
    expect(def?.name).toBe('Bark Shield')
    expect(def?.icon).toBe('🛡️')
    expect(ownsShelfDecor(id)).toBe(true)
  })

  it('returns undefined for a relic name not earned', () => {
    const id = shelfRelicDisplayId('Never Earned')
    expect(getShelfDecorDef(id)).toBeUndefined()
    expect(ownsShelfDecor(id)).toBe(false)
  })

  it('returns undefined for a non-shelf-decor id', () => {
    expect(getShelfDecorDef('reading-lamp')).toBeUndefined()
  })
})
