import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { TIER_HUB_ITEM, CAVE_TIER_HUB_ITEM, LAKE_TIER_HUB_ITEM, OCEAN_TIER_HUB_ITEM } from '../../components/minigames/Fishing'

// Regression guard: lake and cave fish tiers were catchable (Ravenwatch has
// hub-fishing-lake/-cave spots) but had no buyer anywhere in the game — every
// fishmonger's tradeHubItem sell menu only covered river + ocean tiers, so a
// player fishing those locales ended up holding fish nobody would ever buy,
// with every sell choice permanently greyed out no matter how much they held.
const { allQuests } = await getHubWorldData()

const ALL_FISH_ITEM_IDS = [
  ...Object.values(TIER_HUB_ITEM),
  ...Object.values(CAVE_TIER_HUB_ITEM),
  ...Object.values(LAKE_TIER_HUB_ITEM),
  ...Object.values(OCEAN_TIER_HUB_ITEM),
]

function allTradeHubItemWantIds(): Set<string> {
  const ids = new Set<string>()
  for (const tree of Object.values(allQuests.HUB_DIALOGUES)) {
    for (const node of Object.values(tree.nodes)) {
      for (const choice of node.choices ?? []) {
        for (const eff of choice.effects ?? []) {
          if (eff.type !== 'tradeHubItem') continue
          if (eff.wantItemId) ids.add(eff.wantItemId)
          for (const w of eff.wantItems ?? []) ids.add(w.itemId)
        }
      }
    }
  }
  return ids
}

describe('every catchable fish tier has at least one buyer somewhere', () => {
  const wanted = allTradeHubItemWantIds()
  it.each(ALL_FISH_ITEM_IDS)('%s is buyable by some NPC', (id) => {
    expect(wanted.has(id)).toBe(true)
  })
})
