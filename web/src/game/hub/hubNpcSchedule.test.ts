import { describe, it, expect } from 'vitest'
import { getNpcActivity, getNpcDialoguePool, isNpcAsleep, NPC_ACTIVITIES } from './hubNpcSchedule'
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
