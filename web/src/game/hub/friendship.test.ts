import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addFriendshipXp, getFriendshipLevel, getFriendshipData, MAX_FRIENDSHIP_LEVEL } from './friendship'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('friendship', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('starts at level 0 with no data', () => {
    expect(getFriendshipLevel('scholar')).toBe(0)
  })

  it('gaining xp raises the level through the ladder', () => {
    expect(addFriendshipXp('scholar', 5)).toBe(1)   // 5 >= 0
    expect(addFriendshipXp('scholar', 5)).toBe(2)   // 10 >= 10
    expect(addFriendshipXp('scholar', 15)).toBe(3)  // 25 >= 25
  })

  it('losing xp lowers the level, including back through zero into negative', () => {
    addFriendshipXp('scholar', 12) // xp 12 -> level 2
    expect(getFriendshipLevel('scholar')).toBe(2)
    expect(addFriendshipXp('scholar', -20)).toBe(-1) // xp -8 -> level -1
    expect(addFriendshipXp('scholar', -5)).toBe(-2)  // xp -13 -> level -2
  })

  it('reaches MAX_FRIENDSHIP_LEVEL at the top of the ladder and no higher', () => {
    expect(addFriendshipXp('scholar', 1000)).toBe(MAX_FRIENDSHIP_LEVEL)
    expect(addFriendshipXp('scholar', 1000)).toBe(MAX_FRIENDSHIP_LEVEL)
  })

  it('is symmetric in the negative direction', () => {
    expect(addFriendshipXp('scholar', -1000)).toBe(-MAX_FRIENDSHIP_LEVEL)
  })

  it('tracks each NPC independently and persists across reads', () => {
    addFriendshipXp('scholar', 12)
    addFriendshipXp('merchant', -12)
    const data = getFriendshipData()
    expect(data.scholar.level).toBe(2)
    expect(data.merchant.level).toBe(-2)
  })

  it('fails open (level 0) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(getFriendshipLevel('scholar')).toBe(0)
    expect(() => addFriendshipXp('scholar', 5)).not.toThrow()
  })
})
