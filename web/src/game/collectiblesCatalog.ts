// ─── Known Narrative Collectibles ─────────────────────────────────────────────
//
// A self-healing catalog of every narrative-reward collectible (hub quest
// rewards, world-exploration finds, treasure chests, barter trades, Chronicle
// act rewards), aggregated from the current town/quest data by id.
//
// loadInventory() (dailyLogin.ts) prefers this catalog over a player's stored
// display fields for matching ids, so a later data fix (e.g. a corrected icon)
// takes effect immediately for players who already own the item — not just
// for future grants. Without this, a bug fixed in questDefs.json would only
// apply to items collected after the fix shipped; anyone who already earned
// "The Hearthstone" would keep seeing the old broken icon forever, because the
// display fields are captured inline into the player's save at grant time.

import { ALL_QUEST_DEFS, ALL_QUESTS, LOCATION_REGISTRY } from '../data/hub/hubWorldFactory'
import chronicleData from '../data/chronicle.json'

export interface KnownCollectible {
  name: string
  icon: string
  desc: string
  lore?: string
}

function buildKnownCollectibles(): Record<string, KnownCollectible> {
  const known: Record<string, KnownCollectible> = {}

  // Quest-completion rewards (HubWorld.tsx grantQuestReward)
  for (const quest of ALL_QUEST_DEFS) {
    const c = quest.reward.collectible
    if (c) known[c.id] = { name: c.name, icon: c.icon, desc: c.desc }
  }

  for (const { locationData } of Object.values(LOCATION_REGISTRY)) {
    // World-exploration finds (HubWorld.tsx giveItem reaction)
    for (const interactable of locationData.HUB_INTERACTABLES) {
      for (const reaction of interactable.reactions) {
        if (reaction.type === 'giveItem' && reaction.collectible) {
          const c = reaction.collectible
          known[c.id] = { name: c.name, icon: c.icon, desc: c.desc, lore: c.lore }
        }
      }
    }
    // Treasure-chest rewards (HubWorld.tsx handleTreasureStep)
    for (const treasure of locationData.HUB_TREASURES) {
      const c = treasure.reward.collectible
      if (c) known[c.id] = { name: c.name, icon: c.icon, desc: c.desc }
    }
  }

  // Barter-trade rewards (HubWorld.tsx tradeHubItem dialogue effect)
  for (const tree of Object.values(ALL_QUESTS.HUB_DIALOGUES)) {
    for (const node of Object.values(tree.nodes)) {
      for (const choice of node.choices ?? []) {
        for (const effect of choice.effects ?? []) {
          if (effect.type === 'tradeHubItem' && effect.giveCollectible) {
            const c = effect.giveCollectible
            known[c.id] = { name: c.name, icon: c.icon, desc: c.desc }
          }
        }
      }
    }
  }

  // Chronicle act-completion rewards (chronicle.ts grantReward)
  for (const entry of chronicleData as Array<{
    reward?: { type: string; itemId?: string; name?: string; icon?: string; desc?: string; lore?: string }
  }>) {
    const r = entry.reward
    if (r?.type === 'collectible' && r.itemId && r.name && r.icon && r.desc) {
      known[r.itemId] = { name: r.name, icon: r.icon, desc: r.desc, lore: r.lore }
    }
  }

  return known
}

const KNOWN_COLLECTIBLES = buildKnownCollectibles()

/** Look up the current authoritative definition for a narrative-reward collectible id. */
export function getKnownCollectible(id: string): KnownCollectible | undefined {
  return KNOWN_COLLECTIBLES[id]
}
