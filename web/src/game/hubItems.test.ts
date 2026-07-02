import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  addHubItem, removeHubItem, getHubItemCount, hasHubItem, getHubItems,
  getHubItemCatalogEntry,
} from './itemStore'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('hub items', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('stacks catalog items and resolves display fields from the catalog', () => {
    addHubItem('chicken-feed', 2)
    addHubItem('chicken-feed')
    expect(getHubItemCount('chicken-feed')).toBe(3)
    const entry = getHubItems().find(e => e.id === 'chicken-feed')!
    expect(entry.name).toBe('Chicken Feed')
    expect(entry.icon).toBe('🌾')
    expect(entry.category).toBe('material')
  })

  it('never stacks unique catalog items (fishing rod)', () => {
    expect(getHubItemCatalogEntry('fishing-rod')?.unique).toBe(true)
    addHubItem('fishing-rod')
    addHubItem('fishing-rod', 5)
    expect(getHubItemCount('fishing-rod')).toBe(1)
    expect(hasHubItem('fishing-rod')).toBe(true)
  })

  it('stores inline display fields for non-catalog quest items', () => {
    addHubItem('quest:millhaven-mill-grain:grain', 1, {
      name: 'Grain Sack', icon: '🌾', category: 'quest',
    })
    const entry = getHubItems().find(e => e.id === 'quest:millhaven-mill-grain:grain')!
    expect(entry.name).toBe('Grain Sack')
    expect(entry.category).toBe('quest')
  })

  it('removeHubItem fails closed when the balance is insufficient', () => {
    addHubItem('egg', 2)
    expect(removeHubItem('egg', 3)).toBe(false)
    expect(getHubItemCount('egg')).toBe(2)
    expect(removeHubItem('egg', 2)).toBe(true)
    expect(getHubItemCount('egg')).toBe(0)
    expect(hasHubItem('egg')).toBe(false)
    expect(removeHubItem('egg')).toBe(false)
  })

  it('removes the store row entirely when count reaches zero', () => {
    addHubItem('feather')
    expect(removeHubItem('feather')).toBe(true)
    expect(getHubItems().some(e => e.id === 'feather')).toBe(false)
  })

  it('ignores non-positive counts', () => {
    addHubItem('egg', 0)
    addHubItem('egg', -3)
    expect(getHubItemCount('egg')).toBe(0)
    expect(removeHubItem('egg', 0)).toBe(true)
  })
})
