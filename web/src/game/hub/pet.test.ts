import { describe, it, expect, beforeEach } from 'vitest'
import {
  getActivePet, hasActivePet, adoptPet, renamePet, dismissPet,
  getTreatsRemainingToday, canGiveTreat, recordTreatGiven,
  getAffectionCount, getAffectionRemaining, recordAffection,
  getOwnedAccessoryIds, ownsAccessory, grantAccessory,
  getEquippedAccessoryId, equipAccessory, unequipAccessory,
} from './pet'

// Satisfies the treat-interaction gate (3 Pet/Belly-Rubs/Brush interactions).
function maxOutAffection() {
  recordAffection(); recordAffection(); recordAffection()
}

// In-memory localStorage mock (tests run in node environment)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
})

describe('pet store', () => {
  it('has no active pet by default', () => {
    expect(getActivePet()).toBeNull()
    expect(hasActivePet()).toBe(false)
  })

  it('adopts a pet and persists it', () => {
    adoptPet('dog', 'golden', 'Rex')
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'golden', name: 'Rex' })
    expect(hasActivePet()).toBe(true)
  })

  it('persists across reloads (re-reads from the same backing store)', () => {
    adoptPet('dog', 'brown', 'Buddy')
    // Simulate a reload: nothing in-memory is retained beyond the localStorage mock.
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'brown', name: 'Buddy' })
  })

  it('renames the active pet, preserving type/variant', () => {
    adoptPet('dog', 'black', 'Shadow')
    const updated = renamePet('Max')
    expect(updated).toEqual({ type: 'dog', variant: 'black', name: 'Max' })
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'black', name: 'Max' })
  })

  it('renaming with no active pet is a no-op', () => {
    expect(renamePet('Max')).toBeNull()
    expect(getActivePet()).toBeNull()
  })

  it('blank rename falls back to the existing name', () => {
    adoptPet('dog', 'tan', 'Biscuit')
    const updated = renamePet('   ')
    expect(updated?.name).toBe('Biscuit')
  })

  it('adopting again fully replaces the previous pet (swap)', () => {
    adoptPet('dog', 'golden', 'Rex')
    adoptPet('dog', 'black', 'Shadow')
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'black', name: 'Shadow' })
  })

  it('adopts a pet with a coat pattern and persists it', () => {
    adoptPet('cat', 'orange', 'Mochi', 'tabby')
    expect(getActivePet()).toEqual({ type: 'cat', variant: 'orange', name: 'Mochi', pattern: 'tabby' })
  })

  it('omitting a pattern leaves it unset rather than storing "none"', () => {
    adoptPet('dog', 'brown', 'Rex')
    expect(getActivePet()?.pattern).toBeUndefined()
    expect(getActivePet()).toEqual({ type: 'dog', variant: 'brown', name: 'Rex' })
  })

  it('an explicit "none" pattern is treated the same as omitting it', () => {
    adoptPet('dog', 'brown', 'Rex', 'none')
    expect(getActivePet()?.pattern).toBeUndefined()
  })

  it('adopting again fully replaces the previous pattern', () => {
    adoptPet('cat', 'orange', 'Mochi', 'tabby')
    adoptPet('cat', 'black', 'Shadow', 'tuxedo')
    expect(getActivePet()).toEqual({ type: 'cat', variant: 'black', name: 'Shadow', pattern: 'tuxedo' })
  })

  it('dismissing clears the active pet', () => {
    adoptPet('dog', 'golden', 'Rex')
    dismissPet()
    expect(getActivePet()).toBeNull()
    expect(hasActivePet()).toBe(false)
  })

  it('degrades gracefully on corrupt localStorage data', () => {
    store.set('jarv_hub_pet', '{not valid json')
    expect(getActivePet()).toBeNull()
  })

  it('a blank adoption name falls back to a default', () => {
    adoptPet('dog', 'brown', '   ')
    expect(getActivePet()?.name).toBe('Pup')
  })

  it('adopting a new pet preserves the daily treat count', () => {
    adoptPet('dog', 'golden', 'Rex')
    recordTreatGiven()
    adoptPet('dog', 'black', 'Shadow')
    expect(getTreatsRemainingToday()).toBe(1)
  })

  it('dismissing preserves the daily treat count', () => {
    adoptPet('dog', 'golden', 'Rex')
    recordTreatGiven()
    dismissPet()
    expect(getTreatsRemainingToday()).toBe(1)
  })
})

describe('treat cooldown', () => {
  it('starts with 2 treats remaining and no active pet means canGiveTreat is false', () => {
    expect(getTreatsRemainingToday()).toBe(2)
    expect(canGiveTreat()).toBe(false)
  })

  it('decrements remaining count on each treat given', () => {
    adoptPet('dog', 'golden', 'Rex')
    maxOutAffection()
    expect(canGiveTreat()).toBe(true)
    recordTreatGiven()
    expect(getTreatsRemainingToday()).toBe(1)
    maxOutAffection()
    expect(canGiveTreat()).toBe(true)
    recordTreatGiven()
    expect(getTreatsRemainingToday()).toBe(0)
    expect(canGiveTreat()).toBe(false)
  })

  it('floors at 0 and does not go negative', () => {
    adoptPet('dog', 'golden', 'Rex')
    maxOutAffection(); recordTreatGiven()
    maxOutAffection(); recordTreatGiven()
    maxOutAffection(); recordTreatGiven()
    expect(getTreatsRemainingToday()).toBe(0)
  })

  it('resets to the max on a new day', () => {
    adoptPet('dog', 'golden', 'Rex')
    maxOutAffection(); recordTreatGiven()
    maxOutAffection(); recordTreatGiven()
    expect(getTreatsRemainingToday()).toBe(0)
    // Simulate a day change by rewriting the backing store with a stale date.
    const raw = JSON.parse(store.get('jarv_hub_pet')!)
    raw.treats.date = '2000-01-01'
    store.set('jarv_hub_pet', JSON.stringify(raw))
    expect(getTreatsRemainingToday()).toBe(2)
    maxOutAffection()
    expect(canGiveTreat()).toBe(true)
  })
})

describe('treat interaction gate', () => {
  it('requires 3 interactions before a treat can be given', () => {
    adoptPet('dog', 'golden', 'Rex')
    expect(getAffectionCount()).toBe(0)
    expect(getAffectionRemaining()).toBe(3)
    expect(canGiveTreat()).toBe(false)
    recordAffection()
    recordAffection()
    expect(getAffectionRemaining()).toBe(1)
    expect(canGiveTreat()).toBe(false)
    recordAffection()
    expect(getAffectionCount()).toBe(3)
    expect(getAffectionRemaining()).toBe(0)
    expect(canGiveTreat()).toBe(true)
  })

  it('resets the interaction counter after a treat is given', () => {
    adoptPet('dog', 'golden', 'Rex')
    maxOutAffection()
    expect(canGiveTreat()).toBe(true)
    recordTreatGiven()
    expect(getAffectionCount()).toBe(0)
    expect(canGiveTreat()).toBe(false)
  })
})

describe('pet accessories', () => {
  it('owns nothing and has nothing equipped by default', () => {
    expect(getOwnedAccessoryIds()).toEqual([])
    expect(ownsAccessory('leather-collar')).toBe(false)
    expect(getEquippedAccessoryId()).toBeNull()
  })

  it('grants an accessory and it becomes owned', () => {
    expect(grantAccessory('leather-collar')).toBe(true)
    expect(ownsAccessory('leather-collar')).toBe(true)
    expect(getOwnedAccessoryIds()).toEqual(['leather-collar'])
  })

  it('granting the same accessory twice is a no-op the second time', () => {
    expect(grantAccessory('leather-collar')).toBe(true)
    expect(grantAccessory('leather-collar')).toBe(false)
    expect(getOwnedAccessoryIds()).toEqual(['leather-collar'])
  })

  it('cannot equip an unowned or unknown accessory', () => {
    expect(equipAccessory('leather-collar')).toBe(false)
    expect(equipAccessory('not-a-real-accessory')).toBe(false)
    expect(getEquippedAccessoryId()).toBeNull()
  })

  it('equips an owned accessory', () => {
    grantAccessory('leather-collar')
    expect(equipAccessory('leather-collar')).toBe(true)
    expect(getEquippedAccessoryId()).toBe('leather-collar')
  })

  it('equipping a different accessory replaces the previous one (one at a time)', () => {
    grantAccessory('leather-collar')
    grantAccessory('top-hat')
    equipAccessory('leather-collar')
    equipAccessory('top-hat')
    expect(getEquippedAccessoryId()).toBe('top-hat')
  })

  it('unequips the currently-equipped accessory', () => {
    grantAccessory('leather-collar')
    equipAccessory('leather-collar')
    unequipAccessory('leather-collar')
    expect(getEquippedAccessoryId()).toBeNull()
  })

  it('unequipping an accessory that is not the equipped one is a no-op', () => {
    grantAccessory('leather-collar')
    grantAccessory('top-hat')
    equipAccessory('top-hat')
    unequipAccessory('leather-collar')
    expect(getEquippedAccessoryId()).toBe('top-hat')
  })

  it('accessory state persists across adopt/dismiss', () => {
    adoptPet('dog', 'golden', 'Rex')
    grantAccessory('leather-collar')
    equipAccessory('leather-collar')
    dismissPet()
    adoptPet('dog', 'black', 'Shadow')
    expect(getEquippedAccessoryId()).toBe('leather-collar')
    expect(ownsAccessory('leather-collar')).toBe(true)
  })
})
