import { describe, it, expect } from 'vitest'
import { mandatoryMinCount } from './ReplayBriefingScreen'

// ─── mandatoryMinCount (#2296) ──────────────────────────────
//
// Re-anchors the replay-briefing minimum to max(completionCount,
// playerBandTier - 1). Before this, a single defeat dropped the mercy
// minimum to a flat 0 regardless of deck strength — a Mythic-band deck
// (tier 5) got exactly the same floor as a fresh starter deck.

describe('mandatoryMinCount', () => {
  it('uses completionCount when the deck is at or below the act\'s expectation', () => {
    // playerBandTier - 1 = 0 here, so completionCount wins.
    expect(mandatoryMinCount(2, 1, 10)).toBe(2)
  })

  it('raises the floor above completionCount for a deck well above the act\'s band', () => {
    // A Mythic-band (5) deck floors at 4, even on a first-ever run (completionCount 0).
    expect(mandatoryMinCount(0, 5, 10)).toBe(4)
  })

  it('never goes below 0', () => {
    expect(mandatoryMinCount(0, 1, 10)).toBe(0)
  })

  it('never exceeds the number of modifiers the act actually has', () => {
    expect(mandatoryMinCount(0, 5, 2)).toBe(2)
  })

  it('mercy (completionCount 0) still floors at playerBandTier - 1, not an unconditional 0', () => {
    // This is the actual bug: a defeat used to hard-reset to 0 no matter the deck.
    expect(mandatoryMinCount(0, 4, 10)).toBe(3)
    expect(mandatoryMinCount(0, 4, 10)).not.toBe(0)
  })

  it('a completionCount above the deck-power floor still wins — earned tiers are never lowered', () => {
    expect(mandatoryMinCount(5, 2, 10)).toBe(5)
  })
})
