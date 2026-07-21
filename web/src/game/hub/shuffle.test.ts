import { describe, it, expect, vi, afterEach } from 'vitest'
import { shuffled } from './shuffle'

describe('shuffled', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a copy — does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffled(input)
    expect(input).toEqual(copy)
  })

  it('preserves every element (same multiset, no additions/drops)', () => {
    const input = ['warm', 'practical', 'blunt']
    const result = shuffled(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('handles empty and single-element arrays without error', () => {
    expect(shuffled([])).toEqual([])
    expect(shuffled(['only'])).toEqual(['only'])
  })

  it('does not always leave the first element in the first position', () => {
    // Force Math.random to always return 0, which always picks index 0 as
    // the swap partner — for this array size that chain of swaps ends with
    // 'a' displaced from position 0 — a regression to "return arr unchanged"
    // (or any variant that never touches index 0) would fail this.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = shuffled(['a', 'b', 'c', 'd'])
    expect(result[0]).not.toBe('a')
  })
})
