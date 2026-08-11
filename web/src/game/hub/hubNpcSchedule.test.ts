import { describe, it, expect } from 'vitest'
import { getNpcActivity, getNpcDialoguePool, isNpcAsleep, NPC_ACTIVITIES, resolveNpcInteriorPresence } from './hubNpcSchedule'
import type { HubNpc } from '../../data/hub/loader'

const npc: HubNpc = {
  id: 'baker', name: 'Baker', sprite: 'hub-npc-merchant', tx: 5, ty: 5, dialogue: [],
  schedule: [
    { startHour: 6, endHour: 20, activity: 'work', location: { type: 'exterior', tx: 5, ty: 5 } },
    // wraps midnight: 20:00 → 05:59, no activity
    { startHour: 20, endHour: 6, location: { type: 'interior', buildingId: 'inn', tx: 1, ty: 1 } },
  ],
}

describe('getNpcActivity', () => {
  it('returns the activity for the matching hour', () => {
    expect(getNpcActivity(npc, 12)).toBe('work')
  })

  it('returns null when the matching entry has no activity (wraps midnight)', () => {
    expect(getNpcActivity(npc, 23)).toBeNull()
    expect(getNpcActivity(npc, 2)).toBeNull()
  })

  it('returns null when the NPC has no schedule', () => {
    expect(getNpcActivity({ ...npc, schedule: undefined }, 12)).toBeNull()
  })
})

describe('NPC_ACTIVITIES', () => {
  it('lists the activity used in the fixture schedule', () => {
    expect(NPC_ACTIVITIES).toContain('work')
    expect(NPC_ACTIVITIES).toContain('fish')
  })
})

describe('getNpcDialoguePool', () => {
  const flatDialogue = ['flat line one', 'flat line two']

  it('returns the flat dialogue array when the NPC has no schedule', () => {
    const noSchedule: HubNpc = { ...npc, schedule: undefined, dialogue: flatDialogue }
    expect(getNpcDialoguePool(noSchedule, 12)).toBe(flatDialogue)
  })

  it('returns the activity pool when the current activity has an authored pool', () => {
    const withPool: HubNpc = {
      ...npc,
      dialogue: flatDialogue,
      dialogueByActivity: { work: ['fresh loaves!'] },
    }
    expect(getNpcDialoguePool(withPool, 12)).toEqual(['fresh loaves!'])
  })

  it('falls back to the flat dialogue when the current activity has no authored pool', () => {
    const noMatchingPool: HubNpc = {
      ...npc,
      dialogue: flatDialogue,
      dialogueByActivity: { sleep: ['zzz'] },
    }
    expect(getNpcDialoguePool(noMatchingPool, 12)).toBe(flatDialogue)
  })

  it('falls back to the flat dialogue when the authored pool is empty', () => {
    const emptyPool: HubNpc = {
      ...npc,
      dialogue: flatDialogue,
      dialogueByActivity: { work: [] },
    }
    expect(getNpcDialoguePool(emptyPool, 12)).toBe(flatDialogue)
  })
})

describe('isNpcAsleep', () => {
  const sleeper: HubNpc = {
    id: 'baker-pernel', name: 'Baker Pernel', sprite: 'hub-npc-merchant', tx: 5, ty: 5, dialogue: [],
    schedule: [
      { startHour: 0, endHour: 6, activity: 'sleep', location: { type: 'interior', buildingId: 'inn', tx: 9, ty: 2 } },
      { startHour: 6, endHour: 18, activity: 'work', location: { type: 'interior', buildingId: 'bakery', tx: 3, ty: 4 } },
      { startHour: 18, endHour: 24, activity: 'work', location: { type: 'exterior', tx: 8, ty: 7 } },
    ],
  }

  it('is true inside the sleep window', () => {
    expect(isNpcAsleep(sleeper, 0)).toBe(true)
    expect(isNpcAsleep(sleeper, 2)).toBe(true)
    expect(isNpcAsleep(sleeper, 5)).toBe(true)
  })

  it('is false once the sleep window ends', () => {
    expect(isNpcAsleep(sleeper, 6)).toBe(false)
    expect(isNpcAsleep(sleeper, 12)).toBe(false)
  })

  it('is false for NPCs without a schedule', () => {
    expect(isNpcAsleep({ ...sleeper, schedule: undefined }, 2)).toBe(false)
  })

  it('handles a midnight-wrapping sleep window', () => {
    const wrapsMidnight: HubNpc = {
      ...sleeper,
      schedule: [
        { startHour: 22, endHour: 6, activity: 'sleep', location: { type: 'interior', buildingId: 'inn', tx: 1, ty: 1 } },
        { startHour: 6, endHour: 22, activity: 'work', location: { type: 'exterior', tx: 5, ty: 5 } },
      ],
    }
    expect(isNpcAsleep(wrapsMidnight, 23)).toBe(true)
    expect(isNpcAsleep(wrapsMidnight, 3)).toBe(true)
    expect(isNpcAsleep(wrapsMidnight, 6)).toBe(false)
    expect(isNpcAsleep(wrapsMidnight, 21)).toBe(false)
  })
})

describe('resolveNpcInteriorPresence', () => {
  // A shopkeeper on a day shift, sleeping upstairs at night — modelled on
  // Ravenwatch's Gildwyn/Vorn pair (#2111): their static `building` is the
  // shop, but their schedule's own tx/ty differs from their static position,
  // and their sleep entry points at a different building entirely.
  const shopkeeper: HubNpc = {
    id: 'gildwyn', name: 'Gildwyn', sprite: 'hub-npc-merchant', tx: 4, ty: 5, dialogue: [],
    building: 'card-shop',
    schedule: [
      { startHour: 6, endHour: 20, activity: 'work', location: { type: 'interior', buildingId: 'card-shop', tx: 6, ty: 3 } },
      { startHour: 20, endHour: 6, activity: 'sleep', location: { type: 'interior', buildingId: 'inn-upstairs', tx: 2, ty: 1 } },
    ],
  }

  it('resolves a scheduled resident to their shift position, not their static tx/ty', () => {
    expect(resolveNpcInteriorPresence(shopkeeper, 'card-shop', 12)).toEqual({ tx: 6, ty: 3 })
  })

  it('resolves a scheduled resident into a different building than their static one', () => {
    // "Follow them to bed" (#2111 point 4): a resident isn't confined to their
    // static `building` once they have a schedule.
    expect(resolveNpcInteriorPresence(shopkeeper, 'inn-upstairs', 23)).toEqual({ tx: 2, ty: 1 })
  })

  it('is absent from their static building while scheduled elsewhere', () => {
    // The bug this whole thing fixes: two shift NPCs must not both resolve
    // present in the same building at once.
    expect(resolveNpcInteriorPresence(shopkeeper, 'card-shop', 23)).toBeNull()
  })

  it('is absent from an unrelated building entirely', () => {
    expect(resolveNpcInteriorPresence(shopkeeper, 'trader-den', 12)).toBeNull()
  })

  it('is absent during an hour their schedule does not cover (a gap)', () => {
    const gappy: HubNpc = {
      ...shopkeeper,
      schedule: [{ startHour: 6, endHour: 20, location: { type: 'interior', buildingId: 'card-shop', tx: 6, ty: 3 } }],
    }
    // No entry covers 20–06 — deliberately no fallback to the static position.
    expect(resolveNpcInteriorPresence(gappy, 'card-shop', 23)).toBeNull()
  })

  it('falls back to the static tx/ty for a resident with no schedule at all', () => {
    const noSchedule: HubNpc = { ...shopkeeper, schedule: undefined }
    expect(resolveNpcInteriorPresence(noSchedule, 'card-shop', 3)).toEqual({ tx: 4, ty: 5 })
  })

  it('a schedule-less resident is absent from any building but their static one', () => {
    const noSchedule: HubNpc = { ...shopkeeper, schedule: undefined }
    expect(resolveNpcInteriorPresence(noSchedule, 'inn-upstairs', 3)).toBeNull()
  })

  it('resolves a schedule-driven visitor with no static building at all', () => {
    // Ravenwatch's Elder: no `building` field, only ever placed by schedule.
    const visitor: HubNpc = {
      id: 'elder', name: 'The Elder', sprite: 'hub-npc-elder', tx: 19, ty: 10, dialogue: [],
      schedule: [{ startHour: 6, endHour: 20, location: { type: 'interior', buildingId: 'town-hall', tx: 7, ty: 3 } }],
    }
    expect(resolveNpcInteriorPresence(visitor, 'town-hall', 12)).toEqual({ tx: 7, ty: 3 })
    expect(resolveNpcInteriorPresence(visitor, 'town-hall', 23)).toBeNull()
  })

  it('is absent everywhere for a schedule-less NPC with no static building', () => {
    const nobody: HubNpc = { id: 'ghost', name: 'Nobody', sprite: 'x', tx: 0, ty: 0, dialogue: [] }
    expect(resolveNpcInteriorPresence(nobody, 'card-shop', 12)).toBeNull()
  })
})
