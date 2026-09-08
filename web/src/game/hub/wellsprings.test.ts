import { describe, it, expect } from 'vitest'
import { wellKeeperDialogue } from './wellsprings'

describe('wellKeeperDialogue', () => {
  const distances = (state: Parameters<typeof wellKeeperDialogue>[0]) =>
    wellKeeperDialogue(state).map(d => d.atDistance)

  it('always offers a far line and a nearer, more specific one', () => {
    for (const hasCrank of [true, false]) {
      for (const restoredToday of [true, false]) {
        const lines = wellKeeperDialogue({ hasCrank, restoredToday })
        expect(lines).toHaveLength(2)
        expect(lines[0].atDistance).toBeGreaterThan(lines[1].atDistance)
        for (const line of lines) expect(line.text.length).toBeGreaterThan(0)
      }
    }
    expect(distances({ hasCrank: true, restoredToday: false })).toEqual([8, 4])
  })

  it('points a player without the crank at where to buy one', () => {
    const lines = wellKeeperDialogue({ hasCrank: false, restoredToday: false })
    expect(lines.some(l => /crank/i.test(l.text))).toBe(true)
    expect(lines.some(l => /Gearford/.test(l.text))).toBe(true)
  })

  it('nudges toward the well once the player can actually fix it', () => {
    const lines = wellKeeperDialogue({ hasCrank: true, restoredToday: false })
    expect(lines.some(l => /dry/i.test(l.text))).toBe(true)
    // No point naming the crank at someone already carrying one.
    expect(lines.some(l => /crank/i.test(l.text))).toBe(false)
  })

  it('stops nagging once the well has been put right today', () => {
    const lines = wellKeeperDialogue({ hasCrank: true, restoredToday: true })
    expect(lines.some(l => /dry/i.test(l.text))).toBe(false)
    expect(lines.some(l => /clean|thanks/i.test(l.text))).toBe(true)
  })
})
