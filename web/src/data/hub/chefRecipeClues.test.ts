import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { SECRET_RECIPES } from '../../game/hub/chefCooking'
import { getHubItemCatalogEntry } from '../../game/itemStore'

// A secret recipe (docs/hubworld.md §7h) is only "secret" — rather than
// undiscoverable — because some other NPC gossips about it. This guards that
// contract: every recipe must have at least one authored conversation-topic
// tree, in any town, that names all of its ingredients, so a player who talks
// to people can actually learn the combination.
const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

/** Lower-cased words of a line, punctuation dropped — so "CHICKEN FEED." and
 *  "chicken feed," both tokenize to ['chicken', 'feed']. Word matching is done
 *  by comparing token runs rather than by building a regex out of an item
 *  name, which keeps this free of any constructed-pattern surface. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** Every line a player can read out of a conversation-topic tree. */
function topicTreeTexts(): string[][] {
  const texts: string[][] = []
  for (const { locationQuests } of Object.values(LOCATION_REGISTRY)) {
    for (const topic of Object.values(locationQuests.HUB_CONVERSATION_TOPICS)) {
      const tree = locationQuests.HUB_DIALOGUES[topic.treeId]
      if (!tree) continue
      const lines: string[] = []
      for (const node of Object.values(tree.nodes)) {
        lines.push(node.text)
        for (const choice of node.choices ?? []) lines.push(choice.label)
      }
      texts.push(words(lines.join(' ')))
    }
  }
  return texts
}

const TREE_TEXTS = topicTreeTexts()

/** True when every name appears in `text` as a whole word (or whole phrase). */
function mentionsAll(text: string[], names: string[]): boolean {
  return names.every(name => {
    const needle = words(name)
    return needle.length > 0 && text.some((_, i) => needle.every((word, j) => text[i + j] === word))
  })
}

describe('every secret recipe has a clue somewhere in the world', () => {
  for (const recipe of SECRET_RECIPES) {
    it(`${recipe.id} is hinted at by an authored conversation topic`, () => {
      const names = recipe.ingredients.map(id => getHubItemCatalogEntry(id)?.name ?? id)
      const clue = TREE_TEXTS.some(text => mentionsAll(text, names))
      expect(clue, `no conversation topic names all of: ${names.join(', ')}`).toBe(true)
    })
  }
})
