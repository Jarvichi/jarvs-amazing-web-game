import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDailyBounties,
  getBountySlotKey,
  getBountyState,
  acceptBounty,
  isBountyAccepted,
  isBountyCompleted,
  turnInBounty,
  hasUnclaimedBounties,
} from './bounties'
import { saveCrystals, loadCrystals } from '../collection'

// In-memory localStorage mock (tests run in node environment)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
})

const DAY = new Date('2026-06-30T12:00:00Z')

describe('getDailyBounties', () => {
  it('is deterministic for a fixed date', () => {
    expect(getDailyBounties(DAY)).toEqual(getDailyBounties(DAY))
  })

  it('returns 3 distinct bounties', () => {
    const bounties = getDailyBounties(DAY)
    expect(bounties.length).toBe(3)
    expect(new Set(bounties.map(b => b.id)).size).toBe(3)
  })

  it('changes with the date', () => {
    const other = new Date('2026-07-01T12:00:00Z')
    expect(getBountySlotKey(DAY)).not.toBe(getBountySlotKey(other))
  })
})

describe('accept / turn-in flow', () => {
  it('starts with nothing accepted or completed', () => {
    const [bounty] = getDailyBounties(DAY)
    expect(isBountyAccepted(bounty.id)).toBe(false)
    expect(isBountyCompleted(bounty.id)).toBe(false)
  })

  it('accepting marks a bounty accepted', () => {
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    expect(isBountyAccepted(bounty.id)).toBe(true)
    expect(getBountyState().accepted).toContain(bounty.id)
  })

  it('turning in an unaccepted bounty grants nothing', () => {
    const [bounty] = getDailyBounties(DAY)
    expect(turnInBounty(bounty.id)).toBe(0)
    expect(isBountyCompleted(bounty.id)).toBe(false)
  })

  it('turning in an accepted bounty grants crystals and marks completed', () => {
    saveCrystals(0)
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    const granted = turnInBounty(bounty.id)
    expect(granted).toBe(bounty.reward.crystals)
    expect(loadCrystals()).toBe(bounty.reward.crystals)
    expect(isBountyAccepted(bounty.id)).toBe(false)
    expect(isBountyCompleted(bounty.id)).toBe(true)
  })

  it('turning in twice only pays out once', () => {
    saveCrystals(0)
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    turnInBounty(bounty.id)
    expect(turnInBounty(bounty.id)).toBe(0)
    expect(loadCrystals()).toBe(bounty.reward.crystals)
  })

  it('persists accepted state across reloads', () => {
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    // A fresh read goes through localStorage again.
    expect(isBountyAccepted(bounty.id)).toBe(true)
  })
})

describe('hasUnclaimedBounties', () => {
  it('is true when nothing has been accepted or completed', () => {
    expect(hasUnclaimedBounties(DAY)).toBe(true)
  })

  it('is false once every bounty is accepted or completed', () => {
    for (const b of getDailyBounties(DAY)) acceptBounty(b.id)
    expect(hasUnclaimedBounties(DAY)).toBe(false)
  })
})
