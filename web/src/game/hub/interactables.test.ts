import { describe, it, expect, beforeEach } from 'vitest'
import {
  interactableStoreKey,
  isInteractableGranted,
  markInteractableGranted,
  getInteractableMoves,
  setInteractableMove,
} from './interactables'

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

describe('interactableStoreKey', () => {
  it('scopes ids by town name', () => {
    expect(interactableStoreKey('Ravenwatch', 'notice-board')).toBe('Ravenwatch:notice-board')
  })
})

describe('grants', () => {
  it('roundtrips a grant', () => {
    const key = interactableStoreKey('Ravenwatch', 'barrel')
    expect(isInteractableGranted(key)).toBe(false)
    markInteractableGranted(key)
    expect(isInteractableGranted(key)).toBe(true)
  })

  it('keeps grants for other keys separate', () => {
    markInteractableGranted('Ravenwatch:a')
    expect(isInteractableGranted('Ravenwatch:b')).toBe(false)
    expect(isInteractableGranted('Millhaven:a')).toBe(false)
  })

  it('falls back to empty on corrupted JSON', () => {
    store.set('jarv_hub_interactable_grants', '{not json')
    expect(isInteractableGranted('Ravenwatch:a')).toBe(false)
    markInteractableGranted('Ravenwatch:a')
    expect(isInteractableGranted('Ravenwatch:a')).toBe(true)
  })
})

describe('moves', () => {
  it('roundtrips a moved position', () => {
    expect(getInteractableMoves()).toEqual({})
    setInteractableMove('Ravenwatch:cat', { tx: 12, ty: 30 })
    expect(getInteractableMoves()).toEqual({ 'Ravenwatch:cat': { tx: 12, ty: 30 } })
  })

  it('overwrites an existing position', () => {
    setInteractableMove('Ravenwatch:cat', { tx: 12, ty: 30 })
    setInteractableMove('Ravenwatch:cat', { tx: 5, ty: 6 })
    expect(getInteractableMoves()['Ravenwatch:cat']).toEqual({ tx: 5, ty: 6 })
  })

  it('falls back to empty on corrupted JSON', () => {
    store.set('jarv_hub_interactable_moves', '][')
    expect(getInteractableMoves()).toEqual({})
    setInteractableMove('Ravenwatch:cat', { tx: 1, ty: 2 })
    expect(getInteractableMoves()['Ravenwatch:cat']).toEqual({ tx: 1, ty: 2 })
  })
})
