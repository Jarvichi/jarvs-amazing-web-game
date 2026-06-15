import { describe, it, expect } from 'vitest'
import { getNpcActivity, NPC_ACTIVITIES } from './hubNpcSchedule'
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
