import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  cook, cookableItems, matchSecretRecipe, resolveGenericDish, hasDiscoveredRecipe,
  MAX_COOK_INGREDIENTS, SECRET_RECIPES, GENERIC_DISHES,
} from './chefCooking'
import { addHubItem, getHubItemCount, getHubItemCatalogEntry } from '../itemStore'
import { loadCrystals, saveCrystals } from '../collection'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

const FRUIT_PIE = ['rainwater', 'wild-berries', 'chicken-feed']

function stock(ids: string[], count = 1): void {
  for (const id of ids) addHubItem(id, count)
}

describe('chefCooking recipe data', () => {
  it('ships exactly eight secret recipes', () => {
    expect(SECRET_RECIPES).toHaveLength(8)
  })

  it('every recipe/dish item id exists in the hub-item catalog', () => {
    for (const recipe of SECRET_RECIPES) {
      expect(getHubItemCatalogEntry(recipe.dishItemId), `${recipe.id} dish`).toBeTruthy()
      for (const id of recipe.ingredients) {
        expect(getHubItemCatalogEntry(id), `${recipe.id} ingredient ${id}`).toBeTruthy()
      }
    }
    for (const dish of GENERIC_DISHES) {
      expect(getHubItemCatalogEntry(dish.dishItemId), `${dish.id} dish`).toBeTruthy()
      for (const id of dish.anyOfItems ?? []) {
        expect(getHubItemCatalogEntry(id), `${dish.id} match id ${id}`).toBeTruthy()
      }
    }
  })

  it('no two secret recipes share the same ingredient set', () => {
    const keys = SECRET_RECIPES.map(r => [...r.ingredients].sort().join('+'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every secret recipe fits inside the ingredient cap', () => {
    for (const recipe of SECRET_RECIPES) {
      expect(recipe.ingredients.length).toBeLessThanOrEqual(MAX_COOK_INGREDIENTS)
    }
  })

  it('ends the generic dish list with a catch-all', () => {
    expect(GENERIC_DISHES[GENERIC_DISHES.length - 1].anyOfItems).toBeUndefined()
  })
})

describe('matchSecretRecipe', () => {
  it('matches regardless of the order items were picked', () => {
    expect(matchSecretRecipe(['chicken-feed', 'rainwater', 'wild-berries'])?.id).toBe('fruit-pie')
  })

  it('does not match a subset of a recipe', () => {
    expect(matchSecretRecipe(['rainwater', 'wild-berries'])).toBeUndefined()
  })

  it('does not match a recipe with an extra item thrown in', () => {
    expect(matchSecretRecipe([...FRUIT_PIE, 'feather'])).toBeUndefined()
  })
})

describe('resolveGenericDish', () => {
  it('picks fish stew when any fish is in the pot', () => {
    expect(resolveGenericDish(['fish-small', 'feather']).dishItemId).toBe('fish-stew')
  })

  it('picks the salad for foraged greens', () => {
    expect(resolveGenericDish(['wild-berries', 'pressed-flower']).dishItemId).toBe('foragers-salad')
  })

  it('stews orchard fruit rather than dropping it in the salad', () => {
    expect(resolveGenericDish(['apple', 'pressed-flower']).dishItemId).toBe('stewed-fruit')
    expect(resolveGenericDish(['crab-apple']).dishItemId).toBe('stewed-fruit')
  })

  it('falls back to slop when nothing is edible', () => {
    expect(resolveGenericDish(['feather', 'bones', 'mouldy-slipper']).dishItemId).toBe('bowl-of-slop')
  })
})

describe('cook', () => {
  beforeEach(() => {
    installLocalStorageStub()
    saveCrystals(0)
  })

  it('consumes the ingredients and hands back the secret dish', () => {
    stock(FRUIT_PIE)
    const result = cook(FRUIT_PIE)
    expect(result?.recipe?.id).toBe('fruit-pie')
    expect(getHubItemCount('fruit-pie')).toBe(1)
    for (const id of FRUIT_PIE) expect(getHubItemCount(id)).toBe(0)
  })

  it('pays the discovery bonus once and only once', () => {
    stock(FRUIT_PIE, 2)
    const first = cook(FRUIT_PIE)
    expect(first?.firstDiscovery).toBe(true)
    expect(first?.crystals).toBeGreaterThan(0)
    expect(loadCrystals()).toBe(first!.crystals)
    expect(hasDiscoveredRecipe('fruit-pie')).toBe(true)

    const second = cook(FRUIT_PIE)
    expect(second?.firstDiscovery).toBe(false)
    expect(second?.crystals).toBe(0)
    expect(loadCrystals()).toBe(first!.crystals)
    expect(getHubItemCount('fruit-pie')).toBe(2)
  })

  it('falls back to a generic dish for an unknown combination', () => {
    stock(['fish-small', 'feather'])
    const result = cook(['fish-small', 'feather'])
    expect(result?.recipe).toBeUndefined()
    expect(result?.dishItemId).toBe('fish-stew')
    expect(result?.crystals).toBe(0)
    expect(result?.friendshipXp).toBe(0)
  })

  it('refuses an empty selection', () => {
    expect(cook([])).toBeNull()
  })

  it('refuses more ingredients than the cap allows', () => {
    const ids = ['egg', 'feather', 'bones', 'honey', 'log', 'charcoal']
    stock(ids)
    expect(cook(ids)).toBeNull()
    for (const id of ids) expect(getHubItemCount(id)).toBe(1)
  })

  it('takes nothing when an ingredient is not actually held', () => {
    stock(['rainwater', 'wild-berries'])
    expect(cook(FRUIT_PIE)).toBeNull()
    expect(getHubItemCount('rainwater')).toBe(1)
    expect(getHubItemCount('wild-berries')).toBe(1)
    expect(getHubItemCount('fruit-pie')).toBe(0)
  })
})

describe('cookableItems', () => {
  beforeEach(() => { installLocalStorageStub() })

  it('offers held materials and leaves tools out of the pot', () => {
    stock(['egg'])
    addHubItem('fishing-rod', 1)
    const ids = cookableItems().map(i => i.id)
    expect(ids).toContain('egg')
    expect(ids).not.toContain('fishing-rod')
  })
})
