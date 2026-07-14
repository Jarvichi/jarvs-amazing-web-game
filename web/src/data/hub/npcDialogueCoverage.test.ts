import { describe, it, expect } from 'vitest'
import { LOCATION_REGISTRY } from './hubWorldFactory'

// Guard for the activity-aware dialogue content pass (#1960): every scheduled
// NPC whose schedule includes a `sleep` entry must have both a non-empty
// `dialogueByActivity.sleep` pool (ambient speech bubbles, HubTownCanvas) and
// a `sleepDialogue` string (the tap-gate narration, HubWorld's `isNpcAsleep`
// check) — otherwise a sleeping NPC either bubbles nothing or falls back to
// the generic "fast asleep" default instead of an authored line.
//
// Scoped to towns that have completed their #1960 content batch so far;
// widen TOWNS_WITH_CONTENT as each subsequent batch lands, and drop the
// allowlist entirely once every town is covered.
const TOWNS_WITH_CONTENT = ['millhaven', 'capital-city', 'royal-palace', 'ironhold-keep', 'gearford']

describe('scheduled-NPC sleep dialogue coverage', () => {
  for (const townKey of TOWNS_WITH_CONTENT) {
    const { locationData } = LOCATION_REGISTRY[townKey]

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
