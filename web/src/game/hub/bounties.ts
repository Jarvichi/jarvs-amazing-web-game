// ─── Hub Bounty Board ───────────────────────────────────────────────────────
//
// Date-seeded daily bounty rotation + accept/turn-in persistence. Pairs with
// BountyBoardModal.tsx and the 'bounty-board' interactable screen.

import { saveCrystals, loadCrystals } from '../collection'

const KEY = 'jarv_hub_bounties'

export interface BountyReward {
  crystals: number
}

export interface BountyDef {
  id: string
  title: string
  desc: string
  icon: string
  reward: BountyReward
}

const BOUNTY_TEMPLATES: BountyDef[] = [
  { id: 'clear-the-ratcatchers-debt',  title: "Clear the Ratcatcher's Debt", desc: 'Word is the ratcatcher owes the town a favour. Settle it on his behalf.', icon: '🐀', reward: { crystals: 40 } },
  { id: 'patrol-the-walls',            title: 'Patrol the Walls',           desc: 'Walk the town walls and report anything out of the ordinary.',          icon: '🛡️', reward: { crystals: 35 } },
  { id: 'clear-the-old-well',          title: 'Clear the Old Well',         desc: 'The old well has clogged again — someone needs to clear it out.',       icon: '🪣', reward: { crystals: 30 } },
  { id: 'escort-the-merchant',         title: 'Escort the Merchant',        desc: 'A travelling merchant wants safe passage through town.',                icon: '🧳', reward: { crystals: 50 } },
  { id: 'quiet-the-crows',             title: 'Quiet the Crows',            desc: "The crows won't stop circling the granary. Scare them off.",            icon: '🐦‍⬛', reward: { crystals: 25 } },
  { id: 'mend-the-fences',             title: 'Mend the Fences',            desc: 'A few fences on the outskirts could use mending before the storm.',     icon: '🔨', reward: { crystals: 45 } },
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

/** Returns a key identifying the current day's bounty slot. Format: "YYYY-MM-DD". */
export function getBountySlotKey(at?: Date): string {
  return (at ?? new Date()).toISOString().slice(0, 10)
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
}

function freshBountyState(): BountyState {
  return { date: getBountySlotKey(), accepted: [], completed: [] }
}

export function getBountyState(): BountyState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshBountyState()
    const parsed = JSON.parse(raw) as BountyState
    if (parsed.date !== getBountySlotKey()) return freshBountyState()
    return parsed
  } catch {
    return freshBountyState()
  }
}

function saveBountyState(state: BountyState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
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

/** Turns in an accepted bounty, granting its crystal reward. Returns the crystals granted (0 if not eligible). */
export function turnInBounty(id: string): number {
  const state = getBountyState()
  if (!state.accepted.includes(id) || state.completed.includes(id)) return 0
  const def = BOUNTY_TEMPLATES.find(b => b.id === id)
  if (!def) return 0

  state.accepted  = state.accepted.filter(b => b !== id)
  state.completed.push(id)
  saveBountyState(state)

  saveCrystals(loadCrystals() + def.reward.crystals)
  return def.reward.crystals
}

/** True if today's board has at least one bounty not yet accepted or completed. */
export function hasUnclaimedBounties(at?: Date): boolean {
  const state = getBountyState()
  return getDailyBounties(at).some(b => !state.accepted.includes(b.id) && !state.completed.includes(b.id))
}
