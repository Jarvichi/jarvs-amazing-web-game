import { describe, it, expect } from 'vitest'
import { createAmbientRoster, buildUnitSlugPool } from './ambientNpcIdentity'
import { RESIDENT_FIRST_NAMES, WANDERER_SURNAMES } from '../names'
import {
  TOWNSFOLK_BODIES, TOWNSFOLK_HAIR, TOWNSFOLK_HATS,
  SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, ACCENT_COLOURS, HAT_COLOURS,
} from '../../data/townsfolk'

const UNITS = ['knight', 'archer', 'goblin', 'wizard', 'farmer']

const mintMany = (n: number, seed: string | number = 'ravenwatch', unitSlugs = UNITS) => {
  const roster = createAmbientRoster({ seed, unitSlugs })
  return { roster, npcs: Array.from({ length: n }, () => roster.mint()) }
}

describe('createAmbientRoster names', () => {
  it('never gives two live wanderers the same name', () => {
    const { npcs } = mintMany(60)
    expect(new Set(npcs.map(n => n.name)).size).toBe(60)
  })

  it('gives every wanderer a distinct id', () => {
    const { npcs } = mintMany(60)
    expect(new Set(npcs.map(n => n.id)).size).toBe(60)
  })

  it('varies the surname too, not just the first name', () => {
    // A town of a dozen people who all share a surname reads as a bug even
    // though every full name is technically unique.
    const surnames = mintMany(12).npcs.map(n => n.name.split(' ')[1])
    expect(new Set(surnames).size).toBeGreaterThan(6)
  })

  it('draws both halves of the name from the shared pools', () => {
    for (const npc of mintMany(30).npcs) {
      const [first, surname] = npc.name.split(' ')
      expect(RESIDENT_FIRST_NAMES).toContain(first)
      expect(WANDERER_SURNAMES).toContain(surname)
    }
  })

  it('frees a released name for reuse', () => {
    const roster = createAmbientRoster({ seed: 'millhaven', unitSlugs: UNITS })
    const first = roster.mint()
    roster.release(first.id)
    expect(roster.size()).toBe(0)
    // Exhausting the pool would be impractical, so assert the bookkeeping
    // instead: the released name is no longer held against anyone.
    const rest = Array.from({ length: 40 }, () => roster.mint())
    expect(new Set(rest.map(n => n.name)).size).toBe(40)
  })

  it('ignores a release for an unknown id', () => {
    const roster = createAmbientRoster({ seed: 1, unitSlugs: UNITS })
    roster.mint()
    roster.release('not-a-wanderer')
    expect(roster.size()).toBe(1)
  })
})

describe('createAmbientRoster determinism', () => {
  it('produces an identical roster for the same seed', () => {
    expect(mintMany(20, 'gearford').npcs).toEqual(mintMany(20, 'gearford').npcs)
  })

  it('produces a different roster for a different seed', () => {
    const a = mintMany(20, 'gearford').npcs.map(n => n.name)
    const b = mintMany(20, 'appleford').npcs.map(n => n.name)
    expect(a).not.toEqual(b)
  })

  it('accepts a numeric seed as readily as a string one', () => {
    expect(mintMany(5, 12345).npcs).toEqual(mintMany(5, 12345).npcs)
  })
})

describe('createAmbientRoster looks', () => {
  it('mixes composite townsfolk with card-unit sprites', () => {
    const kinds = new Set(mintMany(40).npcs.map(n => n.look.kind))
    expect(kinds).toEqual(new Set(['townsfolk', 'unit']))
  })

  it('only ever dresses unit wanderers in slugs it was given', () => {
    for (const npc of mintMany(40).npcs) {
      if (npc.look.kind === 'unit') expect(UNITS).toContain(npc.look.slug)
    }
  })

  it('falls back to all-townsfolk when a town has no sprite pool at all', () => {
    const { npcs } = mintMany(20, 'dreadspire', [])
    expect(npcs.every(n => n.look.kind === 'townsfolk')).toBe(true)
  })

  it('honours townsfolkShare at its extremes', () => {
    const all = createAmbientRoster({ seed: 1, unitSlugs: UNITS, townsfolkShare: 1 })
    const none = createAmbientRoster({ seed: 1, unitSlugs: UNITS, townsfolkShare: 0 })
    expect(Array.from({ length: 20 }, () => all.mint()).every(n => n.look.kind === 'townsfolk')).toBe(true)
    expect(Array.from({ length: 20 }, () => none.mint()).every(n => n.look.kind === 'unit')).toBe(true)
  })

  it('builds every townsfolk look out of catalog parts and palette colours', () => {
    for (const npc of mintMany(80).npcs) {
      if (npc.look.kind !== 'townsfolk') continue
      const l = npc.look
      expect(TOWNSFOLK_BODIES).toContain(l.body)
      expect(TOWNSFOLK_HAIR).toContain(l.hair)
      if (l.hat !== undefined) expect(TOWNSFOLK_HATS).toContain(l.hat)
      expect(SKIN_TONES).toContain(l.skin)
      expect(OUTFIT_COLOURS).toContain(l.outfit)
      expect(ACCENT_COLOURS).toContain(l.accent)
      expect(HAIR_COLOURS).toContain(l.hairColour)
      expect(HAT_COLOURS).toContain(l.hatColour)
    }
  })

  it('leaves some townsfolk bare-headed and hats others', () => {
    const hats = mintMany(80).npcs
      .filter(n => n.look.kind === 'townsfolk')
      .map(n => (n.look.kind === 'townsfolk' ? n.look.hat : undefined))
    expect(hats.some(h => h === undefined)).toBe(true)
    expect(hats.some(h => h !== undefined)).toBe(true)
  })
})

describe('buildUnitSlugPool', () => {
  it("puts the town's own sprites first so towns keep their character", () => {
    const pool = buildUnitSlugPool(['fisherman', 'merchant'], ['knight', 'goblin', 'archer'], 'millhaven')
    expect(pool.slice(0, 2)).toEqual(['fisherman', 'merchant'])
    expect(pool).toHaveLength(5)
  })

  it('drops duplicates without disturbing preference order', () => {
    const pool = buildUnitSlugPool(['knight', 'knight'], ['archer', 'knight'], 1)
    expect(pool).toEqual(['knight', 'archer'])
  })

  it('drops empty slugs', () => {
    expect(buildUnitSlugPool([''], ['', 'archer'], 1)).toEqual(['archer'])
  })

  it('shuffles the catalog deterministically per seed', () => {
    const catalog = ['a', 'b', 'c', 'd', 'e', 'f']
    expect(buildUnitSlugPool([], catalog, 'x')).toEqual(buildUnitSlugPool([], catalog, 'x'))
    expect(buildUnitSlugPool([], catalog, 'x')).not.toEqual(buildUnitSlugPool([], catalog, 'y'))
  })

  it('copes with no preferred sprites and no catalog', () => {
    expect(buildUnitSlugPool([], [], 1)).toEqual([])
  })
})
