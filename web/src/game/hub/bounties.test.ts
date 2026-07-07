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
  advanceBountyStep,
  getActiveBountyStep,
  getBountyStepProgress,
  getPendingBountyReport,
  getPendingBountyCollect,
  isBountyCollectPickup,
  reconcileBountyPickups,
  getActiveBountyStepHint,
} from './bounties'
import { saveCrystals, loadCrystals } from '../collection'
import { markPickedUp, isPickedUp } from './pickups'
import { addRelationshipPoints, getRelationship } from './relationships'
import { getFriendshipLevel } from './friendship'

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
// A date whose daily pool deterministically includes both a 'report'-only
// bounty and the multi-step 'fresh-fish-for-the-kitchen' 'collect' bounty.
const FISH_DAY = new Date('2026-01-08T12:00:00Z')

/** Drives every step of a bounty to completion via advanceBountyStep. */
function completeAllSteps(id: string): void {
  let step = getActiveBountyStep(id)
  while (step) {
    advanceBountyStep(id)
    step = getActiveBountyStep(id)
  }
}

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

  it('excludes a relationship-gated bounty until its prerequisite is met', () => {
    const includesGatedBounty = () => {
      for (let day = 1; day <= 60; day++) {
        if (getDailyBounties(new Date(2026, 0, day)).some(b => b.id === 'a-favor-for-a-friend')) return true
      }
      return false
    }
    expect(includesGatedBounty()).toBe(false)
    addRelationshipPoints('scholar', 'ally', 10) // reaches relationship level 1
    expect(includesGatedBounty()).toBe(true)
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

  it('turning in an accepted bounty before its steps are done grants nothing', () => {
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    expect(turnInBounty(bounty.id)).toBe(0)
    expect(isBountyCompleted(bounty.id)).toBe(false)
  })

  it('turning in an accepted, fully-stepped bounty grants crystals and marks completed', () => {
    saveCrystals(0)
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    completeAllSteps(bounty.id)
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
    completeAllSteps(bounty.id)
    turnInBounty(bounty.id)
    expect(turnInBounty(bounty.id)).toBe(0)
    expect(loadCrystals()).toBe(bounty.reward.crystals)
  })

  it('turning in a bounty with friendship/relationship reward grants both and triggers rivalry', () => {
    // 2 points -> relationship level 1 (unlocks the gated bounty's prerequisite).
    addRelationshipPoints('scholar', 'ally', 2)
    acceptBounty('a-favor-for-a-friend')
    completeAllSteps('a-favor-for-a-friend')
    const townNpcs = [{ id: 'scholar' }, { id: 'rival-npc', dislikes: ['scholar'] }]
    // The reward's +8 ally points (2 -> 10) crosses into level 2, so scholar's
    // disliker should gain rival points from the resulting rivalry reaction.
    turnInBounty('a-favor-for-a-friend', townNpcs)
    expect(getFriendshipLevel('scholar')).toBeGreaterThan(0)
    expect(getRelationship('scholar').track).toBe('ally')
    expect(getRelationship('rival-npc').track).toBe('rival')
  })

  it('persists accepted state across reloads', () => {
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    // A fresh read goes through localStorage again.
    expect(isBountyAccepted(bounty.id)).toBe(true)
  })
})

describe('bounty step progress', () => {
  it('every bounty template has at least one step', () => {
    // All 7 templates rotate through getDailyBounties across many dates;
    // sample a wide spread of dates to touch every template at least once.
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const d = new Date(DAY.getTime() + i * 24 * 60 * 60 * 1000)
      for (const b of getDailyBounties(d)) {
        seen.add(b.id)
        expect(b.steps.length).toBeGreaterThan(0)
      }
    }
    expect(seen.size).toBeGreaterThan(3)
  })

  it('advanceBountyStep is a no-op when not accepted', () => {
    const [bounty] = getDailyBounties(DAY)
    advanceBountyStep(bounty.id)
    expect(getBountyStepProgress(bounty.id, bounty.steps[0].key)).toBe(0)
  })

  it('single-step bounty becomes turn-in-ready after one advance', () => {
    const single = getDailyBounties(DAY).find(b => b.steps.length === 1)
    if (!single) return
    acceptBounty(single.id)
    expect(getActiveBountyStep(single.id)?.key).toBe(single.steps[0].key)
    advanceBountyStep(single.id)
    expect(getActiveBountyStep(single.id)).toBeNull()
    expect(turnInBounty(single.id)).toBe(single.reward.crystals)
  })

  it('multi-step bounty requires every step before turn-in succeeds', () => {
    const fish = { id: 'fresh-fish-for-the-kitchen', steps: [{ key: 'collect' }, { key: 'report' }] }
    acceptBounty(fish.id)
    expect(turnInBounty(fish.id)).toBe(0)
    advanceBountyStep(fish.id) // collect
    expect(getActiveBountyStep(fish.id)?.key).toBe('report')
    expect(turnInBounty(fish.id)).toBe(0)
    advanceBountyStep(fish.id) // report
    expect(getActiveBountyStep(fish.id)).toBeNull()
    expect(turnInBounty(fish.id)).toBeGreaterThan(0)
  })

  it('progress persists across reloads', () => {
    const [bounty] = getDailyBounties(DAY)
    acceptBounty(bounty.id)
    advanceBountyStep(bounty.id)
    const progress = getBountyStepProgress(bounty.id, bounty.steps[0].key)
    expect(progress).toBeGreaterThan(0)
    // A fresh read goes through localStorage again.
    expect(getBountyStepProgress(bounty.id, bounty.steps[0].key)).toBe(progress)
  })
})

describe('getPendingBountyReport / getPendingBountyCollect', () => {
  it('getPendingBountyReport returns null when nothing is accepted', () => {
    expect(getPendingBountyReport('elder', DAY)).toBeNull()
  })

  it('getPendingBountyReport returns the bounty once accepted and its report step is active', () => {
    const reportBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'report')!
    const npcId = reportBounty.steps[0].targetNpcId!
    acceptBounty(reportBounty.id)
    expect(getPendingBountyReport(npcId, FISH_DAY)?.id).toBe(reportBounty.id)
    expect(getPendingBountyReport('someone-else', FISH_DAY)).toBeNull()
  })

  it('getPendingBountyReport returns null once the step has already been reported', () => {
    const reportBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'report')!
    const npcId = reportBounty.steps[0].targetNpcId!
    acceptBounty(reportBounty.id)
    advanceBountyStep(reportBounty.id)
    expect(getPendingBountyReport(npcId, FISH_DAY)).toBeNull()
  })

  it('getPendingBountyCollect returns null when nothing is accepted', () => {
    expect(getPendingBountyCollect('fresh-fish-millhaven', FISH_DAY)).toBeNull()
  })

  it('getPendingBountyCollect returns the bounty once accepted and its collect step is active', () => {
    const collectBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'collect')!
    const pickupId = collectBounty.steps[0].pickupIds![0]
    acceptBounty(collectBounty.id)
    expect(getPendingBountyCollect(pickupId, FISH_DAY)?.id).toBe(collectBounty.id)
    expect(getPendingBountyCollect('not-a-real-pickup', FISH_DAY)).toBeNull()
  })

  it('getPendingBountyCollect returns null once collected (active step has moved to report)', () => {
    const collectBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'collect')!
    const pickupId = collectBounty.steps[0].pickupIds![0]
    acceptBounty(collectBounty.id)
    advanceBountyStep(collectBounty.id)
    expect(getPendingBountyCollect(pickupId, FISH_DAY)).toBeNull()
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

describe('isBountyCollectPickup', () => {
  it('is true for a pickup used by some bounty collect step, regardless of rotation/accept state', () => {
    expect(isBountyCollectPickup('fresh-fish-millhaven')).toBe(true)
  })

  it('is false for an unrelated id', () => {
    expect(isBountyCollectPickup('not-a-real-pickup')).toBe(false)
  })
})

describe('reconcileBountyPickups', () => {
  it('un-hides a bounty pickup that was marked picked-up before its bounty ever advanced', () => {
    const collectBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'collect')!
    const pickupId = collectBounty.steps[0].pickupIds![0]

    // Simulate clicking the pickup (e.g. while just exploring the shop) before
    // the bounty was ever accepted — markPickedUp fires, but nothing advances.
    markPickedUp(pickupId)
    expect(isPickedUp(pickupId)).toBe(true)

    // Player accepts the bounty afterwards; its collect step is still at 0.
    acceptBounty(collectBounty.id)
    expect(getBountyStepProgress(collectBounty.id, collectBounty.steps[0].key)).toBe(0)

    reconcileBountyPickups(FISH_DAY)
    expect(isPickedUp(pickupId)).toBe(false)
  })

  it('leaves a pickup hidden once its bounty step has genuinely been collected', () => {
    const collectBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'collect')!
    const pickupId = collectBounty.steps[0].pickupIds![0]

    acceptBounty(collectBounty.id)
    markPickedUp(pickupId)
    advanceBountyStep(collectBounty.id) // genuine collection: progress advances too

    reconcileBountyPickups(FISH_DAY)
    expect(isPickedUp(pickupId)).toBe(true)
  })

  it('leaves unrelated picked-up ids untouched', () => {
    markPickedUp('some-unrelated-pickup')
    reconcileBountyPickups(FISH_DAY)
    expect(isPickedUp('some-unrelated-pickup')).toBe(true)
  })
})

describe('getActiveBountyStepHint', () => {
  it('names the resolved NPC for a report step', () => {
    const reportBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'report')!
    const npcId = reportBounty.steps[0].targetNpcId!
    expect(getActiveBountyStepHint(reportBounty, id => `NPC(${id})`)).toBe(`Report to NPC(${npcId})`)
  })

  it('gives a generic hint for a collect step', () => {
    const collectBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'collect')!
    expect(getActiveBountyStepHint(collectBounty, id => id))
      .toBe('Find the item out in the world to advance this bounty')
  })

  it('is null once every step is complete', () => {
    const reportBounty = getDailyBounties(FISH_DAY).find(b => b.steps[0].type === 'report')!
    acceptBounty(reportBounty.id)
    completeAllSteps(reportBounty.id)
    expect(getActiveBountyStepHint(reportBounty, id => id)).toBeNull()
  })
})
