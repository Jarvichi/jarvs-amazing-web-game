// ─── The Fracture Chronicle (seasonal story arc) ──────────────────────────────
//
// A meta-narrative layer above the act campaign. Chapters are authored in
// src/data/chronicle.json and unlock on real-world dates (or via the dev
// override). Completing a chapter = reading its lore + finishing its battle
// challenge; completion grants the chapter reward and permanently unlocks the
// chapter's Codex entry. Read chapters remain accessible forever.

import { logError } from '../logger'
import { getCardCatalog, getCardThemeTags } from './cards'
import { addConsumable, addCollectible } from './itemStore'
import { loadCrystals, saveCrystals } from './collection'
import type { NewsItem } from './news'
import chronicleData from '../data/chronicle.json'
import consumablesData from '../data/consumables.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChronicleChallenge =
  | { type: 'win_with_tag'; tag: string; count: number }
  | { type: 'win_battles'; count: number }

export type ChronicleReward =
  | { type: 'consumable'; itemId: string; count: number }
  | { type: 'crystals'; amount: number }
  | { type: 'collectible'; itemId: string; name: string; icon: string; desc: string; lore: string }

export interface ChronicleChapterDef {
  id: string
  title: string
  /** ISO date (YYYY-MM-DD) the chapter unlocks for everyone. */
  availableFrom: string
  /** One-liner shown while the chapter is still locked. */
  teaser: string
  lore: string
  challenge: ChronicleChallenge
  reward: ChronicleReward
}

export interface ChronicleChapterStatus {
  def: ChronicleChapterDef
  /** Chapter number (1-based, in availableFrom order). */
  number: number
  available: boolean
  read: boolean
  /** Challenge progress, clamped to the challenge count. */
  progress: number
  completed: boolean
}

export const CHRONICLE_CHAPTERS: ChronicleChapterDef[] =
  (chronicleData as ChronicleChapterDef[])
    .slice()
    .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))

// ── Persistence ───────────────────────────────────────────────────────────────

const CHRONICLE_KEY            = 'jarv_chronicle'
const CHRONICLE_DEV_UNLOCK_KEY = 'jarv_chronicle_dev_unlock'

interface ChronicleSave {
  read: string[]
  /** Challenge progress per chapter id. */
  progress: Record<string, number>
  /** Chapter ids whose challenge finished and reward was granted. */
  completed: string[]
}

function loadSave(): ChronicleSave {
  try {
    const raw = localStorage.getItem(CHRONICLE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChronicleSave>
      return {
        read:      Array.isArray(parsed.read) ? parsed.read : [],
        progress:  parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
        completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      }
    }
  } catch { /* ignore */ }
  return { read: [], progress: {}, completed: [] }
}

function persist(save: ChronicleSave): void {
  try { localStorage.setItem(CHRONICLE_KEY, JSON.stringify(save)) }
  catch (e) { logError('chronicle save failed', { error: String(e) }) }
}

// ── Availability ──────────────────────────────────────────────────────────────

/** Dev/admin override: unlocks every chapter regardless of date. */
export function isChronicleDevUnlocked(): boolean {
  try { return localStorage.getItem(CHRONICLE_DEV_UNLOCK_KEY) === 'true' } catch { return false }
}

export function setChronicleDevUnlocked(on: boolean): void {
  try {
    if (on) localStorage.setItem(CHRONICLE_DEV_UNLOCK_KEY, 'true')
    else localStorage.removeItem(CHRONICLE_DEV_UNLOCK_KEY)
  } catch { /* ignore */ }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isChapterAvailable(def: ChronicleChapterDef): boolean {
  return isChronicleDevUnlocked() || def.availableFrom <= todayISO()
}

// ── Status queries ────────────────────────────────────────────────────────────

export function getChronicleStatus(): ChronicleChapterStatus[] {
  const save = loadSave()
  return CHRONICLE_CHAPTERS.map((def, i) => ({
    def,
    number:    i + 1,
    available: isChapterAvailable(def),
    read:      save.read.includes(def.id),
    progress:  Math.min(def.challenge.count, save.progress[def.id] ?? 0),
    completed: save.completed.includes(def.id),
  }))
}

/** Number of available chapters the player hasn't read yet (title badge). */
export function getUnreadChapterCount(): number {
  return getChronicleStatus().filter(c => c.available && !c.read).length
}

// ── Reading ───────────────────────────────────────────────────────────────────

export function markChapterRead(id: string): void {
  const def = CHRONICLE_CHAPTERS.find(c => c.id === id)
  if (!def || !isChapterAvailable(def)) return
  const save = loadSave()
  if (save.read.includes(id)) return
  save.read.push(id)
  persist(save)
}

// ── Challenge progress ────────────────────────────────────────────────────────

/** Human-readable challenge description for the UI. */
export function describeChallenge(c: ChronicleChallenge): string {
  const battles = (n: number) => n === 1 ? 'a battle' : `${n} battles`
  switch (c.type) {
    case 'win_with_tag': return `Win ${battles(c.count)} playing at least one ${c.tag} card`
    case 'win_battles':  return `Win ${battles(c.count)} (any mode)`
  }
}

/** Human-readable reward description for the UI. */
export function describeReward(r: ChronicleReward): string {
  switch (r.type) {
    case 'consumable': {
      const item = (consumablesData as Array<{ id: string; name: string; icon: string }>)
        .find(c => c.id === r.itemId)
      const name = item ? `${item.icon} ${item.name}` : r.itemId
      return r.count > 1 ? `${name} ×${r.count}` : name
    }
    case 'crystals':    return `💎 ${r.amount} crystals`
    case 'collectible': return `${r.icon} ${r.name}`
  }
}

function grantReward(r: ChronicleReward): void {
  switch (r.type) {
    case 'consumable':
      addConsumable(r.itemId, r.count)
      break
    case 'crystals':
      saveCrystals(loadCrystals() + r.amount)
      break
    case 'collectible':
      addCollectible(r.itemId, { name: r.name, icon: r.icon, desc: r.desc, lore: r.lore })
      break
  }
}

/**
 * Call when the player wins any battle (except training). Advances the
 * challenge of every available chapter the player has read, granting rewards
 * for chapters completed by this win. Returns the newly completed chapters.
 *
 * `playedCardNames` — names of the cards the player played this battle, used
 * to match `win_with_tag` challenges against the card catalog's tags.
 */
export function recordChronicleWin(playedCardNames: string[]): ChronicleChapterDef[] {
  const save = loadSave()
  const newlyCompleted: ChronicleChapterDef[] = []
  let dirty = false

  let playedTags: Set<string> | null = null
  const getPlayedTags = (): Set<string> => {
    if (playedTags) return playedTags
    const catalog = getCardCatalog()
    playedTags = new Set<string>()
    for (const name of playedCardNames) {
      for (const t of getCardThemeTags(name)) playedTags.add(t)
      const unitTags = catalog.find(c => c.name === name)?.unit?.tags ?? []
      for (const t of unitTags) playedTags.add(t)
    }
    return playedTags
  }

  for (const def of CHRONICLE_CHAPTERS) {
    if (save.completed.includes(def.id)) continue
    if (!isChapterAvailable(def)) continue
    // Reading the chapter is part of completing it — unread chapters don't progress
    if (!save.read.includes(def.id)) continue

    const c = def.challenge
    const counts = c.type === 'win_battles'
      || (c.type === 'win_with_tag' && getPlayedTags().has(c.tag))
    if (!counts) continue

    const next = Math.min(c.count, (save.progress[def.id] ?? 0) + 1)
    if (next === (save.progress[def.id] ?? 0)) continue
    save.progress[def.id] = next
    dirty = true

    if (next >= c.count) {
      save.completed.push(def.id)
      grantReward(def.reward)
      newlyCompleted.push(def)
    }
  }

  if (dirty) persist(save)
  return newlyCompleted
}

// ── News surfacing ────────────────────────────────────────────────────────────

/**
 * Synthetic news items announcing available chapters, merged into the
 * What's New feed (newest chapters get the unread badge for free).
 */
export function getChronicleNewsItems(): NewsItem[] {
  return getChronicleStatus()
    .filter(c => c.available)
    .map(c => ({
      id:    `chronicle-${c.def.id}`,
      title: `📜 Chronicle Update: Chapter ${c.number} — ${c.def.title} is now available`,
      body:  `${c.def.teaser}\n\nRead the new chapter in the Fracture Chronicle and complete its challenge to earn ${describeReward(c.def.reward)}.`,
      date:  c.def.availableFrom,
      tag:   'EVENT',
    }))
}
