import { getCardCatalog } from './cards'
import { loadCollection } from './collection'
import { getEverAcquiredRelics } from './itemStore'
import { loadActCount, loadAct, ACT_IDS } from './questline'
import { getCharacterDef, getCharacterState, getCharacterIds } from './characters'
import { getChronicleStatus } from './chronicle'
import relicsData from '../data/relics.json'
import memoryFragmentsData from '../data/memoryFragments.json'

const FRAGMENT_KEY        = 'jarv_memory_fragments'
const HUB_WORLD_UNLOCK_KEY = 'jarv_hub_world_unlocked'
const HUB_DEFAULT_KEY      = 'jarv_hub_default'

export interface MemoryFragment {
  id: string
  actId: string
  nodeId: string
  title: string
  body: string
}

export interface CodexFragmentEntry extends MemoryFragment {
  discovered: boolean
}

export function getDiscoveredFragmentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FRAGMENT_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch { return new Set() }
}

export function isFragmentDiscovered(id: string): boolean {
  return getDiscoveredFragmentIds().has(id)
}

export function isHubWorldUnlocked(): boolean {
  try {
    if (localStorage.getItem(HUB_WORLD_UNLOCK_KEY) === 'true') return true
  } catch { return false }
  // Self-heal: a player who already has every fragment should never be
  // locked out of the hub just because the unlock flag itself never got
  // set (e.g. saves from before this flag existed, or a missed write).
  if (areAllCampaignFragmentsDiscovered()) {
    unlockHubWorld()
    return true
  }
  return false
}

export function unlockHubWorld(): void {
  try { localStorage.setItem(HUB_WORLD_UNLOCK_KEY, 'true') } catch { /* ignore */ }
}

export function loadHubDefault(): 'hub' | 'title' {
  try { const v = localStorage.getItem(HUB_DEFAULT_KEY); return v === 'title' ? 'title' : 'hub' } catch { return 'hub' }
}

export function saveHubDefault(val: 'hub' | 'title'): void {
  try { localStorage.setItem(HUB_DEFAULT_KEY, val) } catch { /* ignore */ }
}

// Hub world unlocks off the original 13-act campaign alone (act ids "act1".."act13")
// — bonus/expansion campaigns layered on top (act ids prefixed "c2", "c3", ...)
// don't gate the hub. Matched positively against the original campaign's fixed,
// historical id shape rather than by excluding known expansion prefixes, so a
// future "c3act1" etc. is automatically bonus content without a code change here.
const ORIGINAL_CAMPAIGN_ACT_ID = /^act\d+$/

export function areAllCampaignFragmentsDiscovered(): boolean {
  const discovered = getDiscoveredFragmentIds()
  return (memoryFragmentsData as MemoryFragment[])
    .filter(f => ORIGINAL_CAMPAIGN_ACT_ID.test(f.actId))
    .every(f => discovered.has(f.id))
}

/** Returns true if this discovery completed all fragments for the act (bonus trigger). */
export function markFragmentDiscovered(id: string): boolean {
  const discovered = getDiscoveredFragmentIds()
  if (discovered.has(id)) return false
  discovered.add(id)
  try { localStorage.setItem(FRAGMENT_KEY, JSON.stringify([...discovered])) } catch { /* ignore */ }
  const frags = memoryFragmentsData as MemoryFragment[]
  const frag = frags.find(f => f.id === id)
  if (!frag) return false
  const actFragIds = frags.filter(f => f.actId === frag.actId).map(f => f.id)
  return actFragIds.every(fid => discovered.has(fid))
}

export function getCodexFragments(): CodexFragmentEntry[] {
  const discovered = getDiscoveredFragmentIds()
  return (memoryFragmentsData as MemoryFragment[]).map(f => ({
    ...f,
    discovered: discovered.has(f.id),
  }))
}

export interface CodexCardEntry {
  name: string
  rarity: string
  cardType: string
  description: string
  lore: string
  unlocked: boolean
}

export interface CodexRelicEntry {
  name: string
  icon: string
  desc: string
  lore: string
  exotic: boolean
  unlocked: boolean
}

export interface CodexWorldEntry {
  actId: string
  title: string
  subtitle: string
  environment: string
  bossName: string
  bossDescription: string
  shardLore: string
  unlocked: boolean
}

export interface CodexConversationStage {
  index: number
  greeting: string
  choices?: Array<{ label: string; response: string }>
  seen: boolean
}

export interface CodexConversationEntry {
  id: string
  name: string
  title: string
  icon: string
  stages: CodexConversationStage[]
  seenCount: number
}

export function getCodexConversations(): CodexConversationEntry[] {
  return getCharacterIds().map(id => {
    const def = getCharacterDef(id)!
    const { count } = getCharacterState(id)
    const stages: CodexConversationStage[] = def.encounters.map((enc, i) => ({
      index: i,
      greeting: enc.greeting,
      choices: enc.choices?.map(c => ({ label: c.label, response: c.response })),
      seen: count > i,
    }))
    return {
      id,
      name: def.name,
      title: def.title,
      icon: def.icon,
      stages,
      seenCount: Math.min(count, def.encounters.length),
    }
  })
}

export function getCodexCards(): CodexCardEntry[] {
  const catalog = getCardCatalog()
  const collection = loadCollection()
  const ownedNames = new Set(collection.map(e => e.cardName))

  return catalog.map(card => ({
    name: card.name,
    rarity: card.rarity,
    cardType: card.cardType,
    description: card.description,
    lore: card.lore ?? '',
    unlocked: ownedNames.has(card.name),
  }))
}

export function getCodexRelics(): CodexRelicEntry[] {
  const everAcquired = new Set(getEverAcquiredRelics())
  return (relicsData as Array<{ name: string; icon: string; desc: string; lore?: string; exotic?: boolean; effects: unknown[] }>).map(r => ({
    name: r.name,
    icon: r.icon,
    desc: r.desc,
    lore: r.lore ?? '',
    exotic: r.exotic === true,
    unlocked: everAcquired.has(r.name),
  }))
}

/** Shard lore is derived from act data rather than a separate file. */
function buildShardLore(act: {
  id: string
  subtitle?: string
  environment?: string
  intro?: Array<{ text?: string }>
  outro?: Array<{ text?: string }>
}): string {
  const lines: string[] = []
  if (act.intro?.[0]?.text) lines.push(act.intro[0].text.split('\n')[0])
  if (act.outro?.[0]?.text) lines.push(act.outro[0].text.split('\n')[0])
  return lines.join(' ') || `One of the shards of the shattered Dominion.`
}

export interface CodexChronicleEntry {
  id: string
  number: number
  title: string
  teaser: string
  lore: string
  /** Chronicle codex entries unlock when the chapter is completed (read + challenge). */
  unlocked: boolean
}

/** Fracture Chronicle chapters — completed chapters become permanent Codex lore. */
export function getCodexChronicle(): CodexChronicleEntry[] {
  return getChronicleStatus().map(c => ({
    id: c.def.id,
    number: c.number,
    title: c.def.title,
    teaser: c.def.teaser,
    lore: c.def.lore,
    unlocked: c.completed,
  }))
}

/** Cross-act lore aggregate for the Codex screen. Loads every act's data on
 *  demand (Codex is a screen the player navigates to, not part of boot). */
export async function getCodexWorld(): Promise<CodexWorldEntry[]> {
  const acts = await Promise.all(ACT_IDS.map(id => loadAct(id)))
  return acts.map(act => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bossNode = Object.values(act.nodes as Record<string, any>).find((n: any) => n.type === 'boss') as any
    const actCompleted = loadActCount(act.id) > 0

    return {
      actId: act.id as string,
      title: act.title as string,
      subtitle: act.subtitle as string ?? '',
      environment: act.environment as string ?? '',
      bossName: bossNode ? (bossNode.bossName ?? bossNode.label ?? '???') : '???',
      bossDescription: bossNode?.description ?? '',
      shardLore: buildShardLore(act),
      unlocked: actCompleted,
    }
  })
}
