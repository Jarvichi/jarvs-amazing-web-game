import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// Guard for the activity-aware dialogue content pass (#1960): every scheduled
// NPC whose schedule includes a `sleep` entry must have both a non-empty
// `dialogueByActivity.sleep` pool (ambient speech bubbles, HubTownCanvas) and
// a `sleepDialogue` string (the tap-gate narration, HubWorld's `isNpcAsleep`
// check) — otherwise a sleeping NPC either bubbles nothing or falls back to
// the generic "fast asleep" default instead of an authored line.
//
// Runs against every town in LOCATION_REGISTRY — #1960's content pass now
// covers every town with scheduled NPCs, so any new sleep-scheduled NPC
// added later (in any town) is covered by this guard automatically.
describe('scheduled-NPC sleep dialogue coverage', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {

    for (const npc of locationData.HUB_NPCS) {
      const hasSleepSchedule = npc.schedule?.some(entry => entry.activity === 'sleep')
      if (!hasSleepSchedule) continue

      it(`${townKey}/${npc.id}: has a non-empty dialogueByActivity.sleep pool`, () => {
        expect(npc.dialogueByActivity?.sleep?.length, `${npc.id} has a sleep schedule entry but no dialogueByActivity.sleep pool`).toBeTruthy()
      })

      it(`${townKey}/${npc.id}: has a sleepDialogue line`, () => {
        expect(npc.sleepDialogue, `${npc.id} has a sleep schedule entry but no sleepDialogue — tapping it while asleep falls back to the generic default`).toBeTruthy()
      })
    }
  }
})
