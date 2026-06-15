import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setDialogueFlag, hasDialogueFlag, getDialogueFlags,
  markNodeSeen, hasNodeSeen,
} from './dialogueFlags'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('dialogueFlags', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('sets and reads flags, deduplicating', () => {
    expect(hasDialogueFlag('met-elder')).toBe(false)
    setDialogueFlag('met-elder')
    setDialogueFlag('met-elder')
    expect(hasDialogueFlag('met-elder')).toBe(true)
    expect(getDialogueFlags()).toEqual(['met-elder'])
  })

  it('tracks seen nodes via the seen:<tree>:<node> convention', () => {
    expect(hasNodeSeen('elder-chat', 'root')).toBe(false)
    markNodeSeen('elder-chat', 'root')
    expect(hasNodeSeen('elder-chat', 'root')).toBe(true)
    expect(hasNodeSeen('elder-chat', 'lore')).toBe(false)
    expect(getDialogueFlags()).toContain('seen:elder-chat:root')
  })

  it('returns empty + false when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => setDialogueFlag('x')).not.toThrow()
    expect(hasDialogueFlag('x')).toBe(false)
    expect(getDialogueFlags()).toEqual([])
  })
})
