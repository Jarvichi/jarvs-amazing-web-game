// ─── Hub Bounty Board ───────────────────────────────────────────────────────
//
// Date-seeded daily bounty rotation + accept/turn-in persistence. Bounty
// objectives are sequential `HubQuestStep`s — the same step types the hub
// quest engine uses — so bounties are effectively quests without a giver.
// Pairs with BountyBoardModal.tsx and the 'bounty-board' interactable screen.

import { saveCrystals, loadCrystals } from '../collection'
import { grantAccessory } from './pet'
import { isPickedUp, unmarkPickedUp } from './pickups'
import type { HubQuestStep, RelationshipGrant } from '../../data/hub/questDefs'
import { addFriendshipXp, getFriendshipLevel } from './friendship'
import { getRelationship, grantRelationshipWithRivalry, type RivalNpc } from './relationships'
import { hashStr, makeSeededRng } from '../seededRandom'
import { hasMetNpc } from './journal'
import ravenwatchConfig from '../../data/hub/ravenwatch/config.json'

const KEY = 'jarv_hub_bounties'

export interface BountyReward {
  crystals: number
  /** Pet accessory id (from petAccessories.ts) granted on turn-in. */
  accessory?: string
  /** npcId -> friendship xp granted on turn-in. */
  friendship?: Record<string, number>
  /** npcId -> relationship track/points granted on turn-in. */
  relationship?: Record<string, RelationshipGrant>
}

export interface BountyDef {
  id: string
  title: string
  desc: string
  icon: string
  reward: BountyReward
  steps: HubQuestStep[]
  /** Gates this bounty from the daily pool until met — see checkBountyPrerequisite. */
  prerequisite?: string
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
  // Relationship-gated: only offered once the scholar considers you an ally.
  // Demonstrates unique bounty content unlocked by NPC relationship level.
  {
    id: 'a-favor-for-a-friend',
    title: 'A Favor for a Friend',
    desc: 'Loremaster Caelen trusts you enough to ask a personal favor. Hear him out.',
    icon: '📜',
    prerequisite: 'relationship:scholar:ally:1',
    reward: { crystals: 30, friendship: { scholar: 8 }, relationship: { scholar: { track: 'ally', points: 8 } } },
    steps: [{ key: 'report', type: 'report', targetNpcId: 'scholar', required: 1 }],
  },
]

const BOUNTIES_PER_DAY = 3

// ── Procedural bounties ─────────────────────────────────────────────────────
//
// "Check on <npc>" and "deliver a parcel from <npc> to <npc>" errands,
// generated from Ravenwatch's own NPC roster and gated on hasMetNpc() so a
// generated bounty is never impossible — met status only ever grows, never
// shrinks, so an offered/accepted procedural bounty stays completable.
//
// These aren't stored anywhere: a procedural id (see PROCEDURAL_ID_RE below)
// fully describes its bounty, so findBountyDef can regenerate the identical
// BountyDef from the id alone at any time (accept/progress/turn-in all
// re-resolve bounties by id, same as the hand-authored ones).

// screen ids that open a core app/progression menu rather than represent a
// town character the player would run an errand for (contrast with e.g.
// shop-* or minigame screens, whose NPCs are still fair errand targets).
const NON_ERRAND_SCREENS = new Set([
  'campaign', 'endless', 'dailychallenge', 'weeklychallenge', 'quickbattle',
  'deckbuilder', 'collection-tabs', 'carddraft', 'minigames', 'commander',
  'hall-of-achievements', 'home-shelf', 'chronicle', 'codex', 'adopt-pet',
])

// Ids already the target of a hand-authored bounty above — excluded from
// procedural "visit" candidates to avoid near-duplicate flavor text (still
// fair game as one side of a procedural "deliver" pair).
const HAND_AUTHORED_TARGETS = new Set(
  BOUNTY_TEMPLATES.flatMap(b => b.steps.map(s => s.targetNpcId).filter((id): id is string => !!id)),
)

interface RavenwatchNpcLite { id: string; name: string; screen?: string }
const RAVENWATCH_NPCS: RavenwatchNpcLite[] = (ravenwatchConfig.npcs as RavenwatchNpcLite[])

function isErrandEligible(npc: RavenwatchNpcLite): boolean {
  if (npc.id.endsWith('-int')) return false        // duplicate interior-only copy of an exterior NPC
  if (npc.id.startsWith('npc_')) return false        // auto-generated id, no authored identity
  if (npc.screen && NON_ERRAND_SCREENS.has(npc.screen)) return false
  return true
}

function npcDisplayName(npcId: string): string {
  return RAVENWATCH_NPCS.find(n => n.id === npcId)?.name ?? npcId
}

function buildVisitBounty(npcId: string): BountyDef {
  const name = npcDisplayName(npcId)
  return {
    id: `visit:${npcId}`,
    title: `Check on ${name}`,
    desc: `${name} hasn't been seen in a while — stop by and say hello.`,
    icon: '👋',
    reward: { crystals: 20 },
    steps: [{ key: 'report', type: 'report', targetNpcId: npcId, required: 1 }],
  }
}

function buildDeliverBounty(fromId: string, toId: string): BountyDef {
  const fromName = npcDisplayName(fromId)
  const toName = npcDisplayName(toId)
  return {
    id: `deliver:${fromId}:${toId}`,
    title: 'A Favor Between Friends',
    desc: `${fromName} has a sealed parcel for ${toName} — pick it up and deliver it.`,
    icon: '📦',
    reward: { crystals: 35 },
    steps: [
      { key: 'pickup',  type: 'report', targetNpcId: fromId, required: 1 },
      { key: 'deliver', type: 'report', targetNpcId: toId,   required: 1 },
    ],
  }
}

/** Every procedural bounty a met-NPC set can currently produce. */
function proceduralBounties(): BountyDef[] {
  const metEligible = RAVENWATCH_NPCS.filter(n => isErrandEligible(n) && hasMetNpc(n.id))
  const bounties: BountyDef[] = []
  for (const npc of metEligible) {
    if (!HAND_AUTHORED_TARGETS.has(npc.id)) bounties.push(buildVisitBounty(npc.id))
  }
  for (const from of metEligible) {
    for (const to of metEligible) {
      if (from.id !== to.id) bounties.push(buildDeliverBounty(from.id, to.id))
    }
  }
  return bounties
}

/** Recognizes a procedural bounty id and regenerates its def — validates
 *  both npc ids are real Ravenwatch NPCs so a garbage/stale id resolves to
 *  undefined rather than a broken bounty. */
function findProceduralBountyDef(id: string): BountyDef | undefined {
  const isRealNpc = (npcId: string) => RAVENWATCH_NPCS.some(n => n.id === npcId)
  if (id.startsWith('visit:')) {
    const npcId = id.slice('visit:'.length)
    return isRealNpc(npcId) ? buildVisitBounty(npcId) : undefined
  }
  if (id.startsWith('deliver:')) {
    const [fromId, toId] = id.slice('deliver:'.length).split(':')
    return fromId && toId && isRealNpc(fromId) && isRealNpc(toId) ? buildDeliverBounty(fromId, toId) : undefined
  }
  return undefined
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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

/** Supports the same `friendship:<npcId>:<level>` / `relationship:<npcId>:<track>:<level>`
 *  forms as `checkPrerequisite` in HubWorld.tsx — duplicated locally (not
 *  imported) since bounties are a plain, non-React module and this parse is
 *  small/stable enough not to warrant a shared cross-layer abstraction. */
function checkBountyPrerequisite(prereq: string): boolean {
  return prereq.split('|').every(p => {
    const part = p.trim()
    if (part.startsWith('friendship:')) {
      const parts = part.split(':')
      return getFriendshipLevel(parts[1]) >= parseInt(parts[2] ?? '1')
    }
    if (part.startsWith('hatred:')) {
      const parts = part.split(':')
      return getFriendshipLevel(parts[1]) <= -parseInt(parts[2] ?? '1')
    }
    if (part.startsWith('relationship:')) {
      const [, npcId, track, lvl] = part.split(':')
      const rel = getRelationship(npcId)
      return rel.track === track && rel.level >= parseInt(lvl ?? '1')
    }
    return true
  })
}

/** Returns today's 3 active bounties, deterministically chosen for the day. */
export function getDailyBounties(at?: Date): BountyDef[] {
  const slotKey = getBountySlotKey(at)
  const rng     = makeSeededRng(hashStr(slotKey) ^ 0xfeedbeef)
  const pool    = [...BOUNTY_TEMPLATES, ...proceduralBounties()]
    .filter(b => !b.prerequisite || checkBountyPrerequisite(b.prerequisite))
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
  return BOUNTY_TEMPLATES.find(b => b.id === id) ?? findProceduralBountyDef(id)
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

/** Human-readable hint for a bounty's current step, or null once fully done. */
export function getActiveBountyStepHint(bounty: BountyDef, resolveNpcName: (id: string) => string): string | null {
  const step = getActiveBountyStep(bounty.id)
  if (!step) return null
  if (step.type === 'report' && step.targetNpcId) return `Report to ${resolveNpcName(step.targetNpcId)}`
  if (step.type === 'collect') return 'Find the item out in the world to advance this bounty'
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
export function turnInBounty(id: string, townNpcs: RivalNpc[] = []): number {
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
  if (def.reward.friendship) {
    for (const [npcId, xp] of Object.entries(def.reward.friendship)) addFriendshipXp(npcId, xp)
  }
  if (def.reward.relationship) {
    for (const [npcId, grant] of Object.entries(def.reward.relationship)) {
      grantRelationshipWithRivalry(npcId, grant.track, grant.points, townNpcs)
    }
  }
  return def.reward.crystals
}

/** True if today's board has at least one bounty not yet accepted or completed. */
export function hasUnclaimedBounties(at?: Date): boolean {
  const state = getBountyState()
  return getDailyBounties(at).some(b => !state.accepted.includes(b.id) && !state.completed.includes(b.id))
}
