import { describe, it, expect } from 'vitest'
import { getTodaysShelterPets } from './petShelter'

const DAY_A = new Date('2026-06-30T12:00:00Z')
const DAY_B = new Date('2026-07-01T12:00:00Z')

describe('petShelter', () => {
  it('always returns 2 dogs and 2 cats', () => {
    const roster = getTodaysShelterPets(DAY_A)
    expect(roster).toHaveLength(4)
    expect(roster.filter(p => p.type === 'dog')).toHaveLength(2)
    expect(roster.filter(p => p.type === 'cat')).toHaveLength(2)
  })

  it('gives each species distinct variants', () => {
    const roster = getTodaysShelterPets(DAY_A)
    const dogVariants = roster.filter(p => p.type === 'dog').map(p => p.variant)
    const catVariants = roster.filter(p => p.type === 'cat').map(p => p.variant)
    expect(new Set(dogVariants).size).toBe(dogVariants.length)
    expect(new Set(catVariants).size).toBe(catVariants.length)
  })

  it('is deterministic for the same day', () => {
    expect(getTodaysShelterPets(DAY_A)).toEqual(getTodaysShelterPets(DAY_A))
  })

  it('varies across different days', () => {
    expect(getTodaysShelterPets(DAY_A)).not.toEqual(getTodaysShelterPets(DAY_B))
  })

  it('never uses the literal pattern id "none"', () => {
    const roster = getTodaysShelterPets(DAY_A)
    for (const pet of roster) expect(pet.pattern).not.toBe('none')
  })
})
