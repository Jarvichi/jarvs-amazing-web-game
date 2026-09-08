import { describe, it, expect } from 'vitest'
import { stowhandDialogue } from './stowages'

describe('stowhandDialogue', () => {
  const distances = (state: Parameters<typeof stowhandDialogue>[0]) =>
    stowhandDialogue(state).map(d => d.atDistance)

  it('always offers a far line and a nearer, more specific one', () => {
    for (const hasHook of [true, false]) {
      for (const packedToday of [true, false]) {
        const lines = stowhandDialogue({ hasHook, packedToday })
        expect(lines).toHaveLength(2)
        expect(lines[0].atDistance).toBeGreaterThan(lines[1].atDistance)
        for (const line of lines) expect(line.text.length).toBeGreaterThan(0)
      }
    }
    expect(distances({ hasHook: true, packedToday: false })).toEqual([8, 4])
  })

  it('points a player without the hook at where to buy one', () => {
    // The whole discovery path for this game: a player who has never heard of
    // the hook learns it exists and which town sells it.
    const lines = stowhandDialogue({ hasHook: false, packedToday: false })
    expect(lines.some(l => /hook/i.test(l.text))).toBe(true)
    expect(lines.some(l => /Millhaven/.test(l.text))).toBe(true)
  })

  it('nudges toward the crate once the player can actually pack it', () => {
    const lines = stowhandDialogue({ hasHook: true, packedToday: false })
    expect(lines.some(l => /hurry/i.test(l.text))).toBe(true)
    // No point naming the shop at someone already carrying the hook.
    expect(lines.some(l => /Millhaven/.test(l.text))).toBe(false)
  })

  it('stops nagging once the crate has been packed today', () => {
    const lines = stowhandDialogue({ hasHook: true, packedToday: true })
    expect(lines.some(l => /hurry/i.test(l.text))).toBe(false)
    expect(lines.some(l => /packed square|drum/i.test(l.text))).toBe(true)
  })
})
