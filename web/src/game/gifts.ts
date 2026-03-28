// ─── Gift System ──────────────────────────────────────────────────────────────
// One-off gifts the developer can distribute by adding documents to the
// Firestore `gifts` collection. Each document ID is the gift ID; fields map
// to GiftDef. Falls back to gifts.json if Firestore is unavailable.
//
// Firestore rules required (see firestore.rules):
//   match /gifts/{giftId} {
//     allow read: if true;                       // public read
//     allow write: if request.auth.token.admin == true;  // admin SDK / custom claim
//   }
//
// Firestore document schema (matches GiftDef):
//   name:        string
//   description: string
//   createdAt:   string  (ISO date, e.g. "2026-03-28")
//   expiresAt:   string  (ISO date, optional)
//   rewards:     array of GiftReward objects

import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'
import { addCardsToCollection } from './collection'
import { saveCrystals, loadCrystals } from './collection'
import { addItem } from './itemStore'
import { generatePack } from './collection'
import giftsData from '../data/gifts.json'

// ── Types ────────────────────────────────────────────────────────────────────

export type GiftRewardType = 'crystals' | 'card' | 'pack' | 'consumable' | 'item'

export interface GiftReward {
  type: GiftRewardType
  /** crystals: amount to add */
  amount?: number
  /** card: exact card name to add (1 copy) */
  cardName?: string
  /** pack: number of cards to generate */
  count?: number
  /** consumable: consumable id */
  consumableId?: string
  /** consumable: how many to add (default 1) */
  consumableCount?: number
  /** item: useless item id */
  itemId?: string
}

export interface GiftDef {
  id: string
  name: string
  description: string
  createdAt: string
  /** Optional ISO date; gift is unavailable after this date */
  expiresAt?: string
  rewards: GiftReward[]
}

// ── Storage ──────────────────────────────────────────────────────────────────

const CLAIMED_GIFTS_KEY = 'jarv_claimed_gifts'

export function loadClaimedGiftIds(): string[] {
  try {
    const raw = localStorage.getItem(CLAIMED_GIFTS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return []
}

function saveClaimedGiftIds(ids: string[]): void {
  try {
    localStorage.setItem(CLAIMED_GIFTS_KEY, JSON.stringify(ids))
  } catch (e) {
    logError('saveClaimedGiftIds failed', { error: String(e) })
  }
}

export function markGiftClaimed(id: string): void {
  const ids = loadClaimedGiftIds()
  if (!ids.includes(id)) {
    saveClaimedGiftIds([...ids, id])
  }
}

export function resetClaimedGifts(): void {
  try {
    localStorage.removeItem(CLAIMED_GIFTS_KEY)
  } catch { /* ignore */ }
}

// ── Firestore fetch ───────────────────────────────────────────────────────────

async function fetchGiftsFromFirestore(): Promise<GiftDef[]> {
  const snap = await getDocs(collection(db, 'gifts'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GiftDef))
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Fetch all gifts: Firestore first, local gifts.json as fallback.
 * Merges both sources so locally-seeded gifts still appear if Firestore
 * returns an empty collection (e.g. project not yet configured).
 */
export async function getAllGifts(): Promise<GiftDef[]> {
  let remote: GiftDef[] = []
  try {
    remote = await fetchGiftsFromFirestore()
  } catch (e) {
    logError('fetchGiftsFromFirestore failed, using local fallback', { error: String(e) })
  }

  // Merge: remote takes precedence; include local gifts not present in remote
  const remoteIds = new Set(remote.map(g => g.id))
  const local = (giftsData as GiftDef[]).filter(g => !remoteIds.has(g.id))
  return [...remote, ...local]
}

/** Returns gifts that are available (not expired) and not yet claimed by this player. */
export async function getUnclaimedGifts(): Promise<GiftDef[]> {
  const all = await getAllGifts()
  const claimed = new Set(loadClaimedGiftIds())
  const today = new Date().toISOString().slice(0, 10)
  return all.filter(g => {
    if (claimed.has(g.id)) return false
    if (g.expiresAt && g.expiresAt < today) return false
    return true
  })
}

// ── Reward application ────────────────────────────────────────────────────────

/** Apply all rewards from a gift and mark it claimed. Returns crystals delta. */
export function applyGiftRewards(gift: GiftDef): number {
  let crystalsDelta = 0
  for (const reward of gift.rewards) {
    try {
      if (reward.type === 'crystals' && reward.amount) {
        const next = loadCrystals() + reward.amount
        saveCrystals(next)
        crystalsDelta += reward.amount
      } else if (reward.type === 'card' && reward.cardName) {
        addCardsToCollection([{ cardName: reward.cardName, count: 1 }])
      } else if (reward.type === 'pack') {
        const names = generatePack().slice(0, reward.count ?? 5)
        addCardsToCollection(names.map(name => ({ cardName: name, count: 1 })))
      } else if (reward.type === 'consumable' && reward.consumableId) {
        addItem('consumable', reward.consumableId, reward.consumableCount ?? 1)
      } else if (reward.type === 'item' && reward.itemId) {
        addItem('item', reward.itemId, 1)
      }
    } catch (e) {
      logError('applyGiftReward failed', { rewardType: reward.type, error: String(e) })
    }
  }
  markGiftClaimed(gift.id)
  return crystalsDelta
}

/** Summarise a reward as a short human-readable string for display. */
export function rewardSummary(reward: GiftReward): string {
  switch (reward.type) {
    case 'crystals':   return `${reward.amount} Crystals`
    case 'card':       return `Card: ${reward.cardName}`
    case 'pack':       return `Card Pack (${reward.count ?? 5} cards)`
    case 'consumable': return `Consumable ×${reward.consumableCount ?? 1}`
    case 'item':       return `Inventory item`
    default:           return 'Unknown reward'
  }
}
