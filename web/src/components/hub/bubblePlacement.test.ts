import { describe, it, expect } from 'vitest'
import { leftShiftToClear, type Rect } from './bubblePlacement'

// A minimap-shaped exclusion box pinned to a phone viewport's top-right
// corner, matching how HubMinimap actually sits on screen.
const minimap: Rect = { left: 290, top: 16, right: 390, bottom: 116 }

describe('leftShiftToClear', () => {
  it('does nothing when the bubble sits nowhere near the box', () => {
    expect(leftShiftToClear({ left: 20, top: 400, right: 120, bottom: 440 }, minimap, 6, 999)).toBe(0)
  })

  it('does nothing when the bubble is beside the box but not overlapping', () => {
    // Directly below the minimap — horizontal overlap, no vertical overlap.
    expect(leftShiftToClear({ left: 300, top: 130, right: 380, bottom: 160 }, minimap, 6, 999)).toBe(0)
    // Level with the minimap but well clear to its left — vertical overlap, no horizontal.
    expect(leftShiftToClear({ left: 20, top: 30, right: 100, bottom: 70 }, minimap, 6, 999)).toBe(0)
  })

  it('shifts left exactly enough to clear the box, plus the margin', () => {
    // Bubble's right edge (360) pokes 70px past the minimap's left edge (290).
    const bubble: Rect = { left: 280, top: 40, right: 360, bottom: 80 }
    expect(leftShiftToClear(bubble, minimap, 6, 999)).toBe(76)

    const shifted: Rect = { left: bubble.left - 76, top: bubble.top, right: bubble.right - 76, bottom: bubble.bottom }
    expect(shifted.right).toBeLessThanOrEqual(minimap.left - 6)
  })

  it('is already clear once margin is satisfied, at the boundary', () => {
    const bubble: Rect = { left: 200, top: 40, right: 284, bottom: 80 } // right edge = 290 - 6
    expect(leftShiftToClear(bubble, minimap, 6, 999)).toBe(0)
  })

  it('never returns more than maxShift, even for a deep overlap', () => {
    const bubble: Rect = { left: 300, top: 40, right: 400, bottom: 80 } // fully inside the box
    expect(leftShiftToClear(bubble, minimap, 6, 40)).toBe(40)
  })

  it('returns 0 rather than a negative shift when maxShift is 0', () => {
    const bubble: Rect = { left: 300, top: 40, right: 400, bottom: 80 }
    expect(leftShiftToClear(bubble, minimap, 6, 0)).toBe(0)
  })
})
