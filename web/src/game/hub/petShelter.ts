// ─── Ravenwatch Pet Shelter ─────────────────────────────────────────────────
//
// The Shelter Keeper's daily roster: 2 dogs + 2 cats, deterministically
// re-rolled once per real day (same for every player that day), following
// the same date-seeded pool idiom as getDailyBounties (bounties.ts) /
// getTodaysShopItems (shopStock.ts) — hashStr/makeSeededRng/seededShuffle
// from seededRandom.ts, keyed off a "YYYY-MM-DD" string.

import { hashStr, makeSeededRng, seededShuffle } from '../seededRandom'
import { ANIMAL_SPECS } from './animals'
import { getPatternsForSpecies, type PatternSpecies } from '../../data/petPatterns'

export type ShelterSpecies = 'dog' | 'cat'

export interface ShelterPet {
  type:    ShelterSpecies
  variant: string
  pattern?: string
  name:    string
}

const PETS_PER_SPECIES = 2

const DOG_NAMES = ['Rex', 'Biscuit', 'Duke', 'Willow', 'Scout', 'Peanut', 'Ranger', 'Maple']
const CAT_NAMES = ['Whiskers', 'Mochi', 'Shadow', 'Clementine', 'Smokey', 'Pepper', 'Luna', 'Tumble']

function nameListFor(species: ShelterSpecies): string[] {
  return species === 'dog' ? DOG_NAMES : CAT_NAMES
}

function speciesRoster(species: ShelterSpecies, rng: () => number): ShelterPet[] {
  const variants = seededShuffle(Object.keys(ANIMAL_SPECS[species].palette), rng)
  const patternIds = seededShuffle(
    ['none', ...getPatternsForSpecies(species as PatternSpecies).map(p => p.id)],
    rng,
  )
  const names = seededShuffle(nameListFor(species), rng)

  return Array.from({ length: PETS_PER_SPECIES }, (_, i) => {
    const pattern = patternIds[i % patternIds.length]
    return {
      type: species,
      variant: variants[i % variants.length],
      ...(pattern !== 'none' ? { pattern } : {}),
      name: names[i % names.length],
    }
  })
}

/** Today's shelter roster: 2 dogs + 2 cats, the same for every player on a given real day. */
export function getTodaysShelterPets(at?: Date): ShelterPet[] {
  const dayKey = (at ?? new Date()).toISOString().slice(0, 10)
  const rng = makeSeededRng(hashStr(dayKey) ^ 0x5eed9e7)
  return [...speciesRoster('dog', rng), ...speciesRoster('cat', rng)]
}
