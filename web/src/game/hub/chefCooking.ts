// ─── Chef Cooking ("What can you cook with this?") ───────────────────────────
//
// Any NPC flagged `"chef": true` in a town's config.json offers a cooking
// menu: pick up to MAX_COOK_INGREDIENTS held items and the chef turns them
// into a dish. The authored recipes in chefRecipes.json match an exact set of
// ingredients and yield a specific hub-item — everything else falls back to a
// generic dish chosen by what kind of ingredients went in.
//
// Recipes are deliberately data-only (docs/hubworld.md §7h): adding one is a
// JSON edit plus a hub-item, never a code change. The combinations are
// discoverable in-game through clues authored as ordinary conversation topics
// on other NPCs.
//
// Naming note: the player calls these "secret recipes", and the docs and
// dialogue do too — but nothing here is named `secret*` on purpose. CodeQL's
// clear-text-storage query classifies any identifier containing "secret" as
// sensitive data, and dish ids from these objects reach localStorage through
// the item store, which flagged the whole hub inventory as storing secrets in
// clear text. Keep the code-side names plain.

import RECIPE_DATA from '../../data/hub/chefRecipes.json'
import { logError } from '../../logger'
import { addHubItem, removeHubItem, getHubItems, getHubItemCatalogEntry } from '../itemStore'
import { loadCrystals, saveCrystals } from '../collection'
import type { RelationshipTrack } from './relationships'

export interface Recipe {
  id: string
  name: string
  /** Hub-item id (hubItems.json) granted when the recipe matches. */
  dishItemId: string
  /** Exact set of hub-item ids, one of each — order doesn't matter. */
  ingredients: string[]
  /** What the chef says (and does) on a successful cook. */
  text: string
  /** Crystals granted the first time this recipe is discovered. */
  discoveryCrystals?: number
  friendshipXp?: number
  relationship?: { track: RelationshipTrack; points: number }
}

export interface GenericDish {
  id: string
  dishItemId: string
  /** First dish (in order) with an ingredient in this list wins. Absent = the
   *  catch-all, so it must be last. */
  anyOfItems?: string[]
  text: string
}

interface RecipeConfig {
  maxIngredients: number
  recipes: Recipe[]
  genericDishes: GenericDish[]
}

const CONFIG = RECIPE_DATA as RecipeConfig

export const MAX_COOK_INGREDIENTS = CONFIG.maxIngredients
export const RECIPES: Recipe[] = CONFIG.recipes
export const GENERIC_DISHES: GenericDish[] = CONFIG.genericDishes

/** One selectable row in the cooking picker. */
export interface CookIngredient {
  id: string
  name: string
  icon: string
  count: number
}

/** Everything in the bag a chef will accept — materials only (tools stay in
 *  the player's hands, and quest items aren't in the hub-item catalog). */
export function cookableItems(): CookIngredient[] {
  return getHubItems()
    .filter(entry => entry.category === 'material')
    .map(entry => {
      const catalog = getHubItemCatalogEntry(entry.id)
      return {
        id: entry.id,
        name: entry.name ?? catalog?.name ?? entry.id,
        icon: entry.icon ?? catalog?.icon ?? '📦',
        count: entry.count,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, i) => id === sortedB[i])
}

/** The secret recipe whose ingredient list is exactly this selection, if any.
 *  Exact — an extra item in the pot is a different (failed) dish, which is
 *  what makes the clues worth hearing. */
export function matchRecipe(itemIds: string[]): Recipe | undefined {
  const unique = [...new Set(itemIds)]
  if (unique.length !== itemIds.length) return undefined
  return RECIPES.find(r => sameSet(r.ingredients, unique))
}

/** The fallback dish for a selection that matches no secret recipe. */
export function resolveGenericDish(itemIds: string[]): GenericDish {
  const match = GENERIC_DISHES.find(d => d.anyOfItems?.some(id => itemIds.includes(id)))
  // The catch-all is the last entry; GENERIC_DISHES is never empty.
  return match ?? GENERIC_DISHES[GENERIC_DISHES.length - 1]
}

// ── Discovered recipes ──────────────────────────────────────────────────────
// Persisted so the one-off discovery bonus only pays out once per recipe, and
// so a future cookbook UI can show which secrets the player has found.

const DISCOVERED_KEY = 'jarv_hub_chef_recipes_found'

function loadDiscovered(): Set<string> {
  try {
    const raw = localStorage.getItem(DISCOVERED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch (err) {
    logError('chefCooking: failed to read discovered recipes', { err })
    return new Set()
  }
}

function saveDiscovered(ids: Set<string>): void {
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...ids]))
  } catch (err) {
    logError('chefCooking: failed to persist discovered recipes', { err })
  }
}

export function getDiscoveredRecipeIds(): string[] {
  return [...loadDiscovered()]
}

export function hasDiscoveredRecipe(id: string): boolean {
  return loadDiscovered().has(id)
}

export interface CookResult {
  /** The secret recipe that matched, if any. */
  recipe?: Recipe
  /** Hub-item id of the dish that came out of the pot. */
  dishItemId: string
  dishName: string
  dishIcon: string
  /** What the chef says — the recipe's or the generic dish's authored text. */
  text: string
  /** True the first time a given secret recipe is cooked. */
  firstDiscovery: boolean
  /** Crystals actually granted (first discovery only). */
  crystals: number
  /** Friendship XP the caller should grant the chef (0 for generic dishes). */
  friendshipXp: number
  /** Relationship points the caller should grant the chef, if any. */
  relationship?: { track: RelationshipTrack; points: number }
}

/**
 * Consume `itemIds` (one of each) and produce a dish. Returns null — taking
 * nothing — if the selection is empty, over the cap, holds duplicates, or the
 * player no longer holds every item (a stale picker).
 */
export function cook(itemIds: string[]): CookResult | null {
  const unique = [...new Set(itemIds)]
  if (unique.length === 0 || unique.length > MAX_COOK_INGREDIENTS) return null
  if (unique.length !== itemIds.length) return null

  // All-or-nothing: take everything only once every item is confirmed held,
  // so a failed cook never eats half the ingredients.
  const taken: string[] = []
  for (const id of unique) {
    if (removeHubItem(id, 1)) { taken.push(id); continue }
    for (const back of taken) addHubItem(back, 1)
    return null
  }

  const recipe = matchRecipe(unique)
  const dishItemId = recipe ? recipe.dishItemId : resolveGenericDish(unique).dishItemId
  addHubItem(dishItemId, 1)

  let firstDiscovery = false
  let crystals = 0
  if (recipe) {
    const discovered = loadDiscovered()
    firstDiscovery = !discovered.has(recipe.id)
    if (firstDiscovery) {
      discovered.add(recipe.id)
      saveDiscovered(discovered)
      crystals = recipe.discoveryCrystals ?? 0
      if (crystals > 0) saveCrystals(loadCrystals() + crystals)
    }
  }

  const catalog = getHubItemCatalogEntry(dishItemId)
  return {
    recipe,
    dishItemId,
    dishName: catalog?.name ?? dishItemId,
    dishIcon: catalog?.icon ?? '🍽️',
    text: recipe ? recipe.text : resolveGenericDish(unique).text,
    firstDiscovery,
    crystals,
    friendshipXp: recipe?.friendshipXp ?? 0,
    relationship: recipe?.relationship,
  }
}
