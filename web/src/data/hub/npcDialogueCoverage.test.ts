import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// Guard for §7g conversation topics: a typo'd `conversationTopics` id or
// `treeId` on an authored topic doesn't crash anything at runtime (HubWorld's
// buildTalkGiveOptions filters unresolved topics out silently, falling back
// to the flat "Always good to catch up" line if none resolve) — but it does
// silently swallow authored content, which this test catches instead.
describe('conversation topic coverage', () => {
  for (const [townKey, { locationData, locationQuests }] of Object.entries(LOCATION_REGISTRY)) {
    for (const npc of locationData.HUB_NPCS) {
      for (const topicId of npc.conversationTopics ?? []) {
        it(`${townKey}/${npc.id}: conversation topic "${topicId}" resolves to an authored topic + tree`, () => {
          const topic = locationQuests.HUB_CONVERSATION_TOPICS[topicId]
          expect(topic, `${npc.id} references conversationTopics id "${topicId}" with no matching entry in questDefs.json's conversationTopics array`).toBeTruthy()
          expect(locationQuests.HUB_DIALOGUES[topic.treeId], `${npc.id}'s topic "${topicId}" points at treeId "${topic.treeId}" with no matching dialogues entry`).toBeTruthy()
        })
      }
    }
  }
})

// Guard that every authored conversation-topic tree (§7g) actually ends —
// every choice either advances to a `next` node that exists, or terminates
// via an `end` effect. Catches a dangling choice (no `next`, no `end`) that
// would otherwise silently freeze the conversation on that branch.
describe('conversation topic trees terminate', () => {
  for (const [townKey, { locationQuests }] of Object.entries(LOCATION_REGISTRY)) {
    for (const topic of Object.values(locationQuests.HUB_CONVERSATION_TOPICS)) {
      const tree = locationQuests.HUB_DIALOGUES[topic.treeId]
      if (!tree) continue // covered by the coverage test above

      it(`${townKey}/${topic.id}: every choice advances or ends`, () => {
        for (const [nodeId, node] of Object.entries(tree.nodes)) {
          for (const choice of node.choices ?? []) {
            const hasNext = !!choice.next && !!tree.nodes[choice.next]
            const hasEnd = (choice.effects ?? []).some(e => e.type === 'end')
            expect(hasNext || hasEnd, `${topic.id}/${nodeId} choice "${choice.label}" neither advances to a valid node nor ends the conversation`).toBe(true)
          }
        }
      })
    }
  }
})

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
