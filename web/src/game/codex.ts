import { getCardCatalog } from './cards'
import { loadCollection } from './collection'
import { getRelics } from './itemStore'
import { loadActCount } from './questline'
import relicsData from '../data/relics.json'

import act1Data from '../data/acts/act1.json'
import act2Data from '../data/acts/act2.json'
import act3Data from '../data/acts/act3.json'
import act4Data from '../data/acts/act4.json'
import act5Data from '../data/acts/act5.json'
import act6Data from '../data/acts/act6.json'
import act7Data from '../data/acts/act7.json'
import act8Data from '../data/acts/act8.json'
import act9Data from '../data/acts/act9.json'
import act10Data from '../data/acts/act10.json'
import act11Data from '../data/acts/act11.json'
import act12Data from '../data/acts/act12.json'
import act13Data from '../data/acts/act13.json'
import actFinaleData from '../data/acts/actfinale.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_ACTS: any[] = [
  act1Data, act2Data, act3Data, act4Data, act5Data,
  act6Data, act7Data, act8Data, act9Data, act10Data,
  act11Data, act12Data, act13Data, actFinaleData,
]

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
  const earned = new Set(getRelics())
  return (relicsData as Array<{ name: string; icon: string; desc: string; lore?: string; effects: unknown[] }>).map(r => ({
    name: r.name,
    icon: r.icon,
    desc: r.desc,
    lore: r.lore ?? '',
    unlocked: earned.has(r.name),
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

export function getCodexWorld(): CodexWorldEntry[] {
  return ALL_ACTS.map(act => {
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
