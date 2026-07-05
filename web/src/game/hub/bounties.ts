// ─── Hub Bounty Board ───────────────────────────────────────────────────────
//
// Date-seeded daily bounty rotation + accept/turn-in persistence. Bounty
// objectives are sequential `HubQuestStep`s — the same step types the hub
// quest engine uses — so bounties are effectively quests without a giver.
// Pairs with BountyBoardModal.tsx and the 'bounty-board' interactable screen.

import { saveCrystals, loadCrystals } from '../collection'
import { grantAccessory } from './pet'
import { isPickedUp, unmarkPickedUp } from './pickups'
import type { HubQuestStep } from '../../data/hub/questDefs'

const KEY = 'jarv_hub_bounties'

export interface BountyReward {
  crystals: number
  /** Pet accessory id (from petAccessories.ts) granted on turn-in. */
  accessory?: string
}

export interface BountyDef {
  id: string
  title: string
  desc: string
  icon: string
  reward: BountyReward
  steps: HubQuestStep[]
}

const BOUNTY_TEMPLATES: BountyDef[] = [
  {
    id: 'clear-the-ratcatchers-debt',
    title: 'Word for the Elder',
    desc: "Tell the Elder the ratcatcher's debt has been settled.",
    icon: '🐀',
    reward: { crystals: 40 },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'elder', required: 1 }],
  },
  {
    id: 'patrol-the-walls',
    title: 'Report to the Captain',
    desc: 'Walk the walls, then report what you saw to Guard Captain Thorin.',
    icon: '🛡️',
    reward: { crystals: 35, accessory: 'brown-boots' },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'guard-captain-thorin', required: 1 }],
  },
  {
    id: 'clear-the-old-well',
    title: 'News for Old Greyfish',
    desc: "Let Old Greyfish know the old well's been cleared out.",
    icon: '🪣',
    reward: { crystals: 30 },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'fisherman', required: 1 }],
  },
  {
    id: 'escort-the-merchant',
    title: 'Word for Vex',
    desc: 'Tell Vex the merchant the road is safe for his caravan.',
    icon: '🧳',
    reward: { crystals: 50 },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'merchant', required: 1 }],
  },
  {
    id: 'quiet-the-crows',
    title: 'Tell Rosie',
    desc: "Let Innkeeper Rosie know the granary's crows have quieted down.",
    icon: '🐦‍⬛',
    reward: { crystals: 25 },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'innkeeper-rosie', required: 1 }],
  },
  {
    id: 'mend-the-fences',
    title: 'Word for the Trader',
    desc: 'Pass word to the Junk Trader that the outskirts fences are mended.',
    icon: '🔨',
    reward: { crystals: 45, accessory: 'black-bowtie' },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'trader', required: 1 }],
  },
  {
    id: 'fresh-fish-for-the-kitchen',
    title: 'A Fresh Catch for the Inn',
    desc: "Innkeeper Rosie wants a fresh fish from Millhaven's docks for tonight's stew. Fetch one and bring it back to her.",
    icon: '🐟',
    reward: { crystals: 55 },
    steps: [
      { key: 'collect', type: 'collect', pickupIds: ['fresh-fish-millhaven'], required: 1 },
      { key: 'report',  type: 'report',  targetNpcId: 'innkeeper-rosie',     required: 1 },
    ],
  },
]

const BOUNTIES_PER_DAY = 3

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Simple LCG seeded RNG — deterministic for a given seed. */
function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Numeric hash of a string. */
function dateHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

// Story/test-only override for "now", since callers like BountyBoardModal
// always call getDailyBounties() with no date and have no override prop.
let nowOverride: Date | undefined

/** Pins "today" for all unparametrized getDailyBounties()/getBountyState() calls.
 *  Pass undefined to restore the real clock. Story/test use only. */
export function __setBountyNowOverride(at: Date | undefined): void {
  nowOverride = at
}

/** Returns a key identifying the current day's bounty slot. Format: "YYYY-MM-DD". */
export function getBountySlotKey(at?: Date): string {
  return (at ?? nowOverride ?? new Date()).toISOString().slice(0, 10)
}

/** Returns today's 3 active bounties, deterministically chosen for the day. */
export function getDailyBounties(at?: Date): BountyDef[] {
  const slotKey = getBountySlotKey(at)
  const rng     = makeSeededRng(dateHash(slotKey) ^ 0xfeedbeef)
  const pool    = [...BOUNTY_TEMPLATES]
  const result: BountyDef[] = []
  const used    = new Set<number>()

  while (result.length < BOUNTIES_PER_DAY && result.length < pool.length) {
    const idx = Math.floor(rng() * pool.length)
    if (!used.has(idx)) {
      used.add(idx)
      result.push(pool[idx])
    }
  }
  return result
}

// ── Persisted bounty state ────────────────────────────────────────────────────

export interface BountyState {
  date: string
  accepted: string[]
  completed: string[]
  /** bountyId -> stepKey -> progress count. */
  progress: Record<string, Record<string, number>>
}

function freshBountyState(): BountyState {
  return { date: getBountySlotKey(), accepted: [], completed: [], progress: {} }
}

export function getBountyState(): BountyState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshBountyState()
    const parsed = JSON.parse(raw) as BountyState
    if (parsed.date !== getBountySlotKey()) return freshBountyState()
    if (!parsed.progress) parsed.progress = {}
    return parsed
  } catch {
    return freshBountyState()
  }
}

function saveBountyState(state: BountyState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function findBountyDef(id: string): BountyDef | undefined {
  return BOUNTY_TEMPLATES.find(b => b.id === id)
}

export function isBountyAccepted(id: string): boolean {
  return getBountyState().accepted.includes(id)
}

export function isBountyCompleted(id: string): boolean {
  return getBountyState().completed.includes(id)
}

export function acceptBounty(id: string): void {
  const state = getBountyState()
  if (state.accepted.includes(id) || state.completed.includes(id)) return
  state.accepted.push(id)
  saveBountyState(state)
}

/** Progress on a single step of a bounty, 0 if untouched. */
export function getBountyStepProgress(id: string, stepKey: string): number {
  return getBountyState().progress[id]?.[stepKey] ?? 0
}

/** The first not-yet-complete step of a bounty, or null once every step is done. */
export function getActiveBountyStep(id: string): HubQuestStep | null {
  const def = findBountyDef(id)
  if (!def) return null
  for (const step of def.steps) {
    if (getBountyStepProgress(id, step.key) < step.required) return step
  }
  return null
}

/** Advances the current active step of an accepted, not-yet-completed bounty.
 *  No-op if the bounty isn't accepted, is already completed, or has no active step. */
export function advanceBountyStep(id: string): void {
  const state = getBountyState()
  if (!state.accepted.includes(id) || state.completed.includes(id)) return
  const step = getActiveBountyStep(id)
  if (!step) return

  const bountyProgress = state.progress[id] ?? {}
  bountyProgress[step.key] = (bountyProgress[step.key] ?? 0) + 1
  state.progress[id] = bountyProgress
  saveBountyState(state)
}

/** The accepted, in-progress bounty (if any, among today's bounties) whose
 *  active step is a 'report' addressed to this NPC. */
export function getPendingBountyReport(npcId: string, at?: Date): BountyDef | null {
  const state = getBountyState()
  for (const bounty of getDailyBounties(at)) {
    if (!state.accepted.includes(bounty.id) || state.completed.includes(bounty.id)) continue
    const step = getActiveBountyStep(bounty.id)
    if (step && step.type === 'report' && step.targetNpcId === npcId) return bounty
  }
  return null
}

/** The accepted, in-progress bounty (if any, among today's bounties) whose
 *  active step is a 'collect' that includes this pickup id. */
export function getPendingBountyCollect(pickupId: string, at?: Date): BountyDef | null {
  const state = getBountyState()
  for (const bounty of getDailyBounties(at)) {
    if (!state.accepted.includes(bounty.id) || state.completed.includes(bounty.id)) continue
    const step = getActiveBountyStep(bounty.id)
    if (step && step.type === 'collect' && step.pickupIds?.includes(pickupId)) return bounty
  }
  return null
}

/** Whether this pickup id belongs to any bounty's 'collect' step, across the
 *  full template pool — not just today's rotation. Used to recognize a
 *  bounty pickup even before its bounty has been offered/accepted, so it
 *  isn't treated like an ordinary walk-up-and-grab item. */
export function isBountyCollectPickup(pickupId: string): boolean {
  return BOUNTY_TEMPLATES.some(bounty =>
    bounty.steps.some(step => step.type === 'collect' && step.pickupIds?.includes(pickupId)))
}

/** Un-hides bounty-collect pickups that were marked "picked up" without ever
 *  advancing their bounty's progress — the result of clicking one before its
 *  bounty was accepted (see handleItemPickup). Safe to call unconditionally:
 *  it only touches pickups tied to a currently accepted, still-incomplete
 *  collect step, i.e. pickups the player still needs and currently can't see. */
export function reconcileBountyPickups(at?: Date): void {
  const state = getBountyState()
  for (const bounty of getDailyBounties(at)) {
    if (!state.accepted.includes(bounty.id) || state.completed.includes(bounty.id)) continue
    for (const step of bounty.steps) {
      if (step.type !== 'collect' || !step.pickupIds) continue
      if (getBountyStepProgress(bounty.id, step.key) >= step.required) continue
      for (const pickupId of step.pickupIds) {
        if (isPickedUp(pickupId)) unmarkPickedUp([pickupId])
      }
    }
  }
}

/** Turns in an accepted bounty whose steps are all complete, granting its
 *  crystal reward. Returns the crystals granted (0 if not eligible). */
export function turnInBounty(id: string): number {
  const state = getBountyState()
  if (!state.accepted.includes(id) || state.completed.includes(id)) return 0
  if (getActiveBountyStep(id) !== null) return 0
  const def = findBountyDef(id)
  if (!def) return 0

  state.accepted  = state.accepted.filter(b => b !== id)
  state.completed.push(id)
  saveBountyState(state)

  saveCrystals(loadCrystals() + def.reward.crystals)
  if (def.reward.accessory) grantAccessory(def.reward.accessory)
  return def.reward.crystals
}

/** True if today's board has at least one bounty not yet accepted or completed. */
export function hasUnclaimedBounties(at?: Date): boolean {
  const state = getBountyState()
  return getDailyBounties(at).some(b => !state.accepted.includes(b.id) && !state.completed.includes(b.id))
}
