import type { HubQuestDef, HubQuestReward, HubQuestStep } from '../../data/hub/questDefs'
import type { LocationEntry } from '../../data/hub/hubWorldFactory'
import { getQuestProgress, getQuestState } from './quests'
import {
  getDailyBounties, isBountyAccepted, isBountyCompleted,
  getActiveBountyStep, getBountyStepProgress,
} from './bounties'

/** Every town's data, keyed by location key (App.tsx's `locationRegistry`). */
export type TownRegistry = Record<string, LocationEntry>

export interface NpcHome {
  name: string
  /** The town this NPC belongs to, by display name (HUB_TOWN_NAME). */
  townName: string
}

/**
 * npcId → name and home town, across every town.
 *
 * Quests are deliberately cross-town: the engine scans every town's quests for
 * a deliverable addressed to whoever you just tapped, so a quest accepted in
 * Saltmere can be advanced in Gearford. The menu had no equivalent — it only
 * ever listed the *current* town's quests — so walking away from a quest giver
 * made the quest itself disappear while its items stayed in your bag. This
 * index is what lets the list name a target and say which town they're in.
 */
export function buildNpcHomeIndex(registry: TownRegistry): Map<string, NpcHome> {
  const index = new Map<string, NpcHome>()
  for (const entry of Object.values(registry)) {
    const townName = entry.locationData.HUB_TOWN_NAME
    for (const npc of entry.locationData.HUB_NPCS) {
      if (!npc.name?.trim() || index.has(npc.id)) continue
      index.set(npc.id, { name: npc.name, townName })
    }
    for (const animal of entry.locationData.HUB_ANIMALS) {
      const named = animal as { id: string; name?: string }
      if (!named.name?.trim() || index.has(named.id)) continue
      index.set(named.id, { name: named.name, townName })
    }
  }
  return index
}

export interface QuestTarget {
  npcId: string
  name: string
  townName: string
  /** True when they are standing in the town the player is in right now. */
  here: boolean
}

export interface QuestObjective {
  key: string
  label: string
  current: number
  required: number
  done: boolean
  targetNpcId?: string
}

export interface QuestView {
  id: string
  title: string
  kind: 'quest' | 'bounty'
  /** All objectives satisfied — it only needs handing in. */
  ready: boolean
  objectives: QuestObjective[]
  /** Who to take it to next: the pending deliver target, else the receiver. */
  target: QuestTarget | null
  reward: HubQuestReward
  hint: string
  /** Progress across every objective, for a single summary bar. */
  current: number
  required: number
}

export interface CompletedQuestView {
  id: string
  title: string
  reward: HubQuestReward
}

function stepLabel(step: HubQuestStep, nameOf: (id: string) => string): string {
  if (step.type === 'deliver' && step.targetNpcId) return `Deliver to ${nameOf(step.targetNpcId)}`
  if (step.type === 'report'  && step.targetNpcId) return `Report to ${nameOf(step.targetNpcId)}`
  if (step.type === 'collect' && step.itemName)    return `Collect ${step.itemName}`
  return step.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function activeHint(quest: HubQuestDef): string {
  const { activeDialogue } = quest
  if (typeof activeDialogue === 'string') return activeDialogue
  const values = Object.values(activeDialogue)
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? values[0] ?? ''
    }
  }
  return values[values.length - 1] ?? ''
}

/** All objectives satisfied — the quest needs only handing in. */
export function isQuestReady(quest: HubQuestDef): boolean {
  return quest.steps.every(step => getQuestProgress(quest.id, step.key) >= step.required)
}

interface BuildOptions {
  /** Named NPCs (and animals) physically in the town the player is in. */
  presentNpcIds: Set<string>
  npcHomes: Map<string, NpcHome>
  currentTownName: string
}

function resolveTarget(npcId: string | undefined, opts: BuildOptions): QuestTarget | null {
  if (!npcId) return null
  const home = opts.npcHomes.get(npcId)
  const here = opts.presentNpcIds.has(npcId)
  return {
    npcId,
    name: home?.name ?? npcId,
    // Someone standing in front of you is here whatever their home town says.
    townName: here ? opts.currentTownName : home?.townName ?? opts.currentTownName,
    here,
  }
}

/** Active quests across every town, richest-first: ready to hand in, then in
 *  progress. Bounties are folded in as the same shape so one list covers both. */
export function buildActiveQuestViews(allQuestDefs: HubQuestDef[], opts: BuildOptions): QuestView[] {
  const nameOf = (id: string) => opts.npcHomes.get(id)?.name ?? id
  const views: QuestView[] = []

  for (const quest of allQuestDefs) {
    if (getQuestState(quest.id).status !== 'active') continue

    const objectives: QuestObjective[] = quest.steps.map(step => {
      const current = Math.min(getQuestProgress(quest.id, step.key), step.required)
      return {
        key: step.key,
        label: stepLabel(step, nameOf),
        current,
        required: step.required,
        done: current >= step.required,
        targetNpcId: step.targetNpcId,
      }
    })

    const ready = objectives.every(o => o.done)
    const pending = quest.steps.find(step =>
      (step.type === 'deliver' || step.type === 'report')
      && getQuestProgress(quest.id, step.key) < step.required)

    views.push({
      id: quest.id,
      title: quest.title,
      kind: 'quest',
      ready,
      objectives,
      target: resolveTarget(ready ? quest.receiverNpcId : pending?.targetNpcId, opts),
      reward: quest.reward,
      hint: activeHint(quest),
      current:  objectives.reduce((n, o) => n + o.current, 0),
      required: objectives.reduce((n, o) => n + o.required, 0),
    })
  }

  for (const bounty of getDailyBounties()) {
    if (!isBountyAccepted(bounty.id) || isBountyCompleted(bounty.id)) continue
    const step = getActiveBountyStep(bounty.id)
    const current = step ? getBountyStepProgress(bounty.id, step.key) : 0
    const required = step?.required ?? 1

    views.push({
      id: bounty.id,
      title: bounty.title,
      kind: 'bounty',
      ready: !step,
      objectives: step
        ? [{
            key: step.key,
            label: stepLabel(step, nameOf),
            current: Math.min(current, required),
            required,
            done: current >= required,
            targetNpcId: step.targetNpcId,
          }]
        : [],
      target: resolveTarget(step?.targetNpcId, opts),
      reward: { crystals: bounty.reward.crystals },
      hint: bounty.desc,
      current: Math.min(current, required),
      required,
    })
  }

  // Ready to hand in first, then whatever is closest to done.
  return views.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? -1 : 1
    const aPct = a.required > 0 ? a.current / a.required : 0
    const bPct = b.required > 0 ? b.current / b.required : 0
    return bPct - aPct
  })
}

export function buildCompletedQuestViews(allQuestDefs: HubQuestDef[]): CompletedQuestView[] {
  return allQuestDefs
    .filter(q => getQuestState(q.id).status === 'completed')
    .map(q => ({ id: q.id, title: q.title, reward: q.reward }))
}

/** "+40 💎 · 🌿 Moonleaf Charm", or '' when a quest pays nothing visible. */
export function rewardSummary(reward: HubQuestReward): string {
  const parts: string[] = []
  if (reward.crystals)    parts.push(`+${reward.crystals} 💎`)
  if (reward.collectible) parts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
  return parts.join('  ·  ')
}
