import { describe, it, expect, vi, beforeEach } from 'vitest'

// chronicleVotes imports ../firebase, which calls initializeApp at module load
// with VITE_FIREBASE_* env vars that are unset in the node test environment.
// Stub the Firestore surface rather than standing up a real app; `getDocImpl`
// lets individual tests choose what a read does.
let getDocImpl: () => Promise<unknown> = async () => ({ exists: () => false })

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: () => getDocImpl(),
  setDoc: async () => undefined,
  increment: (n: number) => n,
  Timestamp: { now: () => ({}) },
}))

import {
  totalVotes, voteShare, leadingOption,
  fetchChronicleTally, fetchChronicleTallyStrict,
} from './chronicleVotes'

beforeEach(() => { getDocImpl = async () => ({ exists: () => false }) })

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

// The two reads exist so that "Firestore is down" and "nobody voted" stay
// distinguishable — see docs/chronicle-s2.md §6.1. Collapsing them back into
// one function would let an automated author treat an outage as a real
// unanimous zero and write canon from votes that were never cast, so pin the
// difference here rather than relying on the comment to survive a refactor.
describe('strict vs forgiving tally reads', () => {
  const boom = () => { throw new Error('firestore unreachable') }

  it('both return an empty tally when the document does not exist', async () => {
    getDocImpl = async () => ({ exists: () => false })
    await expect(fetchChronicleTallyStrict('ch7')).resolves.toEqual({})
    await expect(fetchChronicleTally('ch7')).resolves.toEqual({})
  })

  it('the strict read propagates a Firestore failure', async () => {
    getDocImpl = async () => boom()
    await expect(fetchChronicleTallyStrict('ch7')).rejects.toThrow('firestore unreachable')
  })

  it('the forgiving read swallows the same failure as "no data"', async () => {
    getDocImpl = async () => boom()
    await expect(fetchChronicleTally('ch7')).resolves.toEqual({})
  })

  it('reads numeric vote counts and ignores the updatedAt bookkeeping field', async () => {
    // The stored document carries an updatedAt Timestamp alongside the counts;
    // counting it as an option would silently corrupt every share.
    getDocImpl = async () => ({
      exists: () => true,
      data: () => ({ vigil: 7, accord: 3, updatedAt: { seconds: 1, nanoseconds: 0 } }),
    })
    const tally = await fetchChronicleTallyStrict('ch7')
    expect(tally).toEqual({ vigil: 7, accord: 3 })
    expect(totalVotes(tally)).toBe(10)
  })
})
