import { describe, it, expect, vi } from 'vitest'

// chronicleVotes imports ../firebase, which calls initializeApp at module load
// with VITE_FIREBASE_* env vars that are unset in the node test environment.
// Only the pure tally helpers are under test here, so stub the Firestore
// surface rather than standing up a real app.
vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => undefined,
  increment: (n: number) => n,
  Timestamp: { now: () => ({}) },
}))

import { totalVotes, voteShare, leadingOption } from './chronicleVotes'

describe('chronicle vote tally', () => {
  it('totals votes across options', () => {
    expect(totalVotes({})).toBe(0)
    expect(totalVotes({ vigil: 3, accord: 2, unbinding: 5 })).toBe(10)
  })

  it('reports share as a fraction, and null when nothing is counted', () => {
    expect(voteShare({}, 'vigil')).toBeNull()
    expect(voteShare({ vigil: 0, accord: 0 }, 'vigil')).toBeNull()
    const tally = { vigil: 1, accord: 3 }
    expect(voteShare(tally, 'accord')).toBeCloseTo(0.75)
    expect(voteShare(tally, 'vigil')).toBeCloseTo(0.25)
  })

  it('treats an option with no votes as a real 0%, not missing data', () => {
    expect(voteShare({ vigil: 4 }, 'unbinding')).toBe(0)
  })

  it('picks the leading option, and null on a tie or no votes', () => {
    expect(leadingOption({})).toBeNull()
    expect(leadingOption({ vigil: 0 })).toBeNull()
    expect(leadingOption({ vigil: 5, accord: 2 })).toBe('vigil')
    expect(leadingOption({ vigil: 5, accord: 5 })).toBeNull()
  })
})
