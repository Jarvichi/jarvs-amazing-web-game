import { describe, it, expect } from 'vitest'
import { cellarerDialogue } from './casks'

describe('cellarerDialogue', () => {
  const distances = (state: Parameters<typeof cellarerDialogue>[0]) =>
    cellarerDialogue(state).map(d => d.atDistance)

  it('always offers a far line and a nearer, more specific one', () => {
    for (const hasMallet of [true, false]) {
      for (const sortedToday of [true, false]) {
        const lines = cellarerDialogue({ hasMallet, sortedToday })
        expect(lines).toHaveLength(2)
        expect(lines[0].atDistance).toBeGreaterThan(lines[1].atDistance)
        for (const line of lines) expect(line.text.length).toBeGreaterThan(0)
      }
    }
    expect(distances({ hasMallet: true, sortedToday: false })).toEqual([8, 4])
  })

  it('points a player without the mallet at where to buy one', () => {
    const lines = cellarerDialogue({ hasMallet: false, sortedToday: false })
    expect(lines.some(l => /mallet/i.test(l.text))).toBe(true)
    expect(lines.some(l => /Appleford/.test(l.text))).toBe(true)
  })

  it('nudges toward the cellar once the player can actually sort it', () => {
    const lines = cellarerDialogue({ hasMallet: true, sortedToday: false })
    expect(lines.some(l => /turned/i.test(l.text))).toBe(true)
    // No point naming the mallet at someone already carrying one.
    expect(lines.some(l => /Appleford/.test(l.text))).toBe(false)
  })

  it('stops nagging once the cellar has been sorted today', () => {
    const lines = cellarerDialogue({ hasMallet: true, sortedToday: true })
    expect(lines.some(l => /something down there/i.test(l.text))).toBe(false)
    expect(lines.some(l => /honest|thanks/i.test(l.text))).toBe(true)
  })
})
