/**
 * Exotic Quest Chains — multi-step quests that guarantee a specific
 * mythic/legendary card on completion. Like Destiny exotic quests:
 * the card is earned, not lucky.
 *
 * Quest definitions live in src/data/quests.json. Progress persists in
 * localStorage across runs. Steps complete strictly in order — only the
 * chain's first incomplete step accumulates progress.
 */

import { getCardCatalog } from './cards'
import { addCardsToCollection, loadDeck } from './collection'
import { logError } from '../logger'
import questsData from '../data/quests.json'

// ─── Types ────────────────────────────────────────────────

export type QuestCondition =
  | { type: 'win_battles'; count: number; deckTags?: string[]; deckTagPct?: number }
  | { type: 'kill_tagged'; tags: string[]; count: number }
  | { type: 'play_card_type'; cardType: 'unit' | 'structure' | 'upgrade'; count: number }
  | { type: 'defeat_boss'; actId: string }

export interface QuestStepDef {
  label: string
  condition: QuestCondition
}

export interface QuestChainDef {
  id: string
  name: string
  icon: string
  theme: string
  intro: string
  targetCard: string
  steps: QuestStepDef[]
}

export const QUEST_CHAINS: QuestChainDef[] = questsData as QuestChainDef[]

/** Card names that are quest rewards — shown as "Earn via Quest" in the collection. */
export function getQuestTargetCards(): Set<string> {
  return new Set(QUEST_CHAINS.map(q => q.targetCard))
}

/** Returns the quest chain whose reward is the given card, if any. */
export function getQuestForCard(cardName: string): QuestChainDef | undefined {
  return QUEST_CHAINS.find(q => q.targetCard === cardName)
}

// ─── Persistence ──────────────────────────────────────────

const QUEST_KEY = 'jarv_quest_progress'

interface QuestSave {
  /** Progress per step, keyed "{chainId}:{stepIndex}". */
  steps: Record<string, number>
  /** Chain IDs whose reward card has been granted. */
  completed: string[]
}

function loadSave(): QuestSave {
  try {
    const raw = localStorage.getItem(QUEST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QuestSave>
      return {
        steps: parsed.steps && typeof parsed.steps === 'object' ? parsed.steps : {},
        completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      }
    }
  } catch { /* ignore */ }
  return { steps: {}, completed: [] }
}

function persist(save: QuestSave): void {
  try { localStorage.setItem(QUEST_KEY, JSON.stringify(save)) }
  catch (e) { logError('quest save failed', { error: String(e) }) }
}

// ─── Status queries ───────────────────────────────────────

function conditionTarget(c: QuestCondition): number {
  return c.type === 'defeat_boss' ? 1 : c.count
}

export interface QuestChainStatus {
  def: QuestChainDef
  /** Raw progress per step (clamped to target). */
  stepProgress: number[]
  /** Index of the first incomplete step; equals steps.length when done. */
  activeStep: number
  completed: boolean
}

export function getQuestStatuses(): QuestChainStatus[] {
  const save = loadSave()
  return QUEST_CHAINS.map(def => {
    const completed = save.completed.includes(def.id)
    const stepProgress = def.steps.map((s, i) => {
      const target = conditionTarget(s.condition)
      return Math.min(target, save.steps[`${def.id}:${i}`] ?? 0)
    })
    let activeStep = def.steps.findIndex((s, i) => stepProgress[i] < conditionTarget(s.condition))
    if (activeStep === -1 || completed) activeStep = def.steps.length
    return { def, stepProgress, activeStep, completed }
  })
}

/** True if any quest has an in-progress (started but unfinished) step. */
export function hasActiveQuests(): boolean {
  return getQuestStatuses().some(q => !q.completed)
}

// ─── Progress events ──────────────────────────────────────

/**
 * Core progress applicator. For every uncompleted chain, advances the active
 * step if `matches` applies to its condition. When a chain's final step
 * completes, the target card is granted and the chain def is returned.
 */
function applyProgress(matches: (c: QuestCondition) => number): QuestChainDef[] {
  const save = loadSave()
  const newlyCompleted: QuestChainDef[] = []
  let dirty = false

  for (const def of QUEST_CHAINS) {
    if (save.completed.includes(def.id)) continue

    // Active step = first step below target
    let activeIdx = -1
    for (let i = 0; i < def.steps.length; i++) {
      const target = conditionTarget(def.steps[i].condition)
      if ((save.steps[`${def.id}:${i}`] ?? 0) < target) { activeIdx = i; break }
    }
    if (activeIdx === -1) continue   // all steps already done (legacy state) — handled below via completion check

    const step = def.steps[activeIdx]
    const inc = matches(step.condition)
    if (inc <= 0) continue

    const key = `${def.id}:${activeIdx}`
    const target = conditionTarget(step.condition)
    save.steps[key] = Math.min(target, (save.steps[key] ?? 0) + inc)
    dirty = true

    // Chain complete?
    const allDone = def.steps.every((s, i) =>
      (save.steps[`${def.id}:${i}`] ?? 0) >= conditionTarget(s.condition))
    if (allDone) {
      save.completed.push(def.id)
      addCardsToCollection([{ cardName: def.targetCard, count: 1 }])
      newlyCompleted.push(def)
    }
  }

  if (dirty) persist(save)
  return newlyCompleted
}

/** Fraction (0–1) of the player's current deck carrying any of the given tags. */
function deckTagFraction(tags: string[]): number {
  const deck = loadDeck()
  if (deck.length === 0) return 0
  const catalog = getCardCatalog()
  let total = 0
  let tagged = 0
  for (const entry of deck) {
    const card = catalog.find(c => c.name === entry.cardName)
    const count = entry.count ?? 1
    total += count
    const cardTags: string[] = (card as unknown as { tags?: string[] })?.tags ?? []
    if (cardTags.some(t => tags.includes(t))) tagged += count
  }
  return total === 0 ? 0 : tagged / total
}

/** Call when the player wins any battle. Returns chains completed by this event. */
export function recordQuestWin(): QuestChainDef[] {
  return applyProgress(c => {
    if (c.type !== 'win_battles') return 0
    if (c.deckTags && c.deckTagPct && deckTagFraction(c.deckTags) < c.deckTagPct) return 0
    return 1
  })
}

/** Call with the names of enemy units destroyed (per tick batch). */
export function recordQuestKills(killedNames: string[]): QuestChainDef[] {
  if (killedNames.length === 0) return []
  const catalog = getCardCatalog()
  return applyProgress(c => {
    if (c.type !== 'kill_tagged') return 0
    let n = 0
    for (const name of killedNames) {
      const card = catalog.find(x => x.name === name)
      const cardTags: string[] = (card as unknown as { tags?: string[] })?.tags ?? []
      if (cardTags.some(t => c.tags.includes(t))) n++
    }
    return n
  })
}

/** Call when the player plays a card. */
export function recordQuestCardPlayed(cardType: string): QuestChainDef[] {
  return applyProgress(c =>
    c.type === 'play_card_type' && c.cardType === cardType ? 1 : 0)
}

/** Call when a campaign act boss is defeated. */
export function recordQuestBossDefeat(actId: string): QuestChainDef[] {
  return applyProgress(c =>
    c.type === 'defeat_boss' && c.actId === actId ? 1 : 0)
}
