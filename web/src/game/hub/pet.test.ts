import { describe, it, expect, beforeEach } from 'vitest'
import { getActivePet, hasActivePet, adoptPet, renamePet, dismissPet } from './pet'

// In-memory localStorage mock (tests run in node environment)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
})

describe('pet store', () => {
  it('has no active pet by default', () => {
    expect(getActivePet()).toBeNull()
    expect(hasActivePet()).toBe(false)
  })

  it('adopts a pet and persists it', () => {
    adoptPet('dog', 'golden', 'Rex')
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'golden', name: 'Rex' })
    expect(hasActivePet()).toBe(true)
  })

  it('persists across reloads (re-reads from the same backing store)', () => {
    adoptPet('dog', 'brown', 'Buddy')
    // Simulate a reload: nothing in-memory is retained beyond the localStorage mock.
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'brown', name: 'Buddy' })
  })

  it('renames the active pet, preserving type/variant', () => {
    adoptPet('dog', 'black', 'Shadow')
    const updated = renamePet('Max')
    expect(updated).toEqual({ type: 'dog', variant: 'black', name: 'Max' })
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'black', name: 'Max' })
  })

  it('renaming with no active pet is a no-op', () => {
    expect(renamePet('Max')).toBeNull()
    expect(getActivePet()).toBeNull()
  })

  it('blank rename falls back to the existing name', () => {
    adoptPet('dog', 'tan', 'Biscuit')
    const updated = renamePet('   ')
    expect(updated?.name).toBe('Biscuit')
  })

  it('adopting again fully replaces the previous pet (swap)', () => {
    adoptPet('dog', 'golden', 'Rex')
    adoptPet('dog', 'black', 'Shadow')
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'black', name: 'Shadow' })
  })

  it('dismissing clears the active pet', () => {
    adoptPet('dog', 'golden', 'Rex')
    dismissPet()
    expect(getActivePet()).toBeNull()
    expect(hasActivePet()).toBe(false)
  })

  it('degrades gracefully on corrupt localStorage data', () => {
    store.set('jarv_hub_pet', '{not valid json')
    expect(getActivePet()).toBeNull()
  })

  it('a blank adoption name falls back to a default', () => {
    adoptPet('dog', 'brown', '   ')
    expect(getActivePet()?.name).toBe('Pup')
  })
})
