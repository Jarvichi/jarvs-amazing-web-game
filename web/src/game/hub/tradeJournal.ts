// ─── Trade Journal ──────────────────────────────────────────────────────────
//
// Discovery-tracked record of hub-item sellers and buyers the player has
// encountered, mirroring journal.ts's shape/conventions. Fed by the
// buyHubItem and tradeHubItem reaction handlers (HubWorld.tsx) on tap/attempt
// — matching journal.ts's "discovery on tap, not mere visibility" rule.

import { logError } from '../../logger'

const KEY = 'jarv_hub_trade_journal'

export interface SellerEntry {
  itemId: string
  town: string
  speaker: string
  price: number
  currency: 'crystals' | 'tickets'
}

export interface BuyerEntry {
  itemId: string
  town: string
  speaker: string
  rewardSummary: string
}

interface TradeJournalData {
  sellers: SellerEntry[]
  buyers: BuyerEntry[]
}

function emptyData(): TradeJournalData {
  return { sellers: [], buyers: [] }
}

function load(): TradeJournalData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<TradeJournalData>
    return { sellers: parsed.sellers ?? [], buyers: parsed.buyers ?? [] }
  } catch {
    return emptyData()
  }
}

function save(data: TradeJournalData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('tradeJournal save failed', { error: String(e) })
  }
}

function sameSeller(a: SellerEntry, b: SellerEntry): boolean {
  return a.itemId === b.itemId && a.town === b.town && a.speaker === b.speaker
}

function sameBuyer(a: BuyerEntry, b: BuyerEntry): boolean {
  return a.itemId === b.itemId && a.town === b.town && a.speaker === b.speaker
}

/** Record a discovered seller (itemId+town+speaker deduped). Returns true if newly recorded. */
export function recordSellerSeen(entry: SellerEntry): boolean {
  const data = load()
  if (data.sellers.some(s => sameSeller(s, entry))) return false
  data.sellers.push(entry)
  save(data)
  return true
}

/** Record a discovered buyer (itemId+town+speaker deduped). Returns true if newly recorded. */
export function recordBuyerSeen(entry: BuyerEntry): boolean {
  const data = load()
  if (data.buyers.some(b => sameBuyer(b, entry))) return false
  data.buyers.push(entry)
  save(data)
  return true
}

export function getKnownSellers(): SellerEntry[] {
  return load().sellers
}

export function getKnownBuyers(): BuyerEntry[] {
  return load().buyers
}
