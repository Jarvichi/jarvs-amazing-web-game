import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { STOWAGE_TIERS } from '../../components/minigames/Stowage.logic'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// Guard for Stowage's only entrance (docs/minigame-stowage.md §5). The game is
// reached by tapping a town's crate and nowhere else, so a town missing its
// crate interactable — or a stowhand who ended up somewhere the player never
// walks — is the whole feature quietly invisible in that town, with nothing at
// runtime to complain about it.

const STOWAGE_SCREENS = new Set([
  'hub-stowage',
  'hub-stowage-wagon',
  'hub-stowage-hold',
])

/** The loader resolves a decor entry's tileId name to its numeric chip id. */
const CRATE_TILES = new Set([BASE_CHIP_TILES.crate, BASE_CHIP_TILES.openCrate])

/** Chebyshev distance, matching how the hub measures proximity everywhere. */
function tileDistance(a: { tx: number; ty: number }, b: { tx: number; ty: number }): number {
  return Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty))
}

describe('every town has a crate to pack', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
    const crates = locationData.HUB_INTERACTABLES.filter(i =>
      i.reactions.some(r => r.type === 'screen' && STOWAGE_SCREENS.has(r.screen)))

    it(`${townKey}: exactly one crate opening a stowage screen`, () => {
      expect(crates).toHaveLength(1)
    })

    it(`${townKey}: the hitRect sits on a crate tile`, () => {
      const crate = crates[0]
      if (!crate) return
      // Overlays existing decor: a hitRect over scenery already in the town,
      // the same way forage spots overlay an existing bush.
      const onDecor = locationData.EXTERIOR_DECOR.some(
        d => d.tx === crate.tx && d.ty === crate.ty && CRATE_TILES.has(d.tileId))
      expect(onDecor,
        `${townKey}'s stowage interactable is at (${crate.tx}, ${crate.ty}) with no crate drawn there`,
      ).toBe(true)
    })

    it(`${townKey}: a stowhand stands beside the crate to point at it`, () => {
      const crate = crates[0]
      if (!crate) return
      const stowhands = locationData.EXTERIOR_NPCS.filter(n => n.id.endsWith('-stowhand'))
      expect(stowhands, `${townKey} has no *-stowhand in EXTERIOR_NPCS`).toHaveLength(1)
      const stowhand = stowhands[0]
      // HubWorld matches stowhands by this id suffix rather than a list, so the
      // suffix is load-bearing: rename it and the town silently loses its nudge.
      expect(stowhand.id.endsWith('-stowhand')).toBe(true)
      expect(stowhand.name).toBeTruthy()
      expect(stowhand.dialogue?.length ?? 0).toBeGreaterThan(0)
      // Within the stowhand's own near-bubble range of the crate they talk about.
      expect(tileDistance(stowhand, crate),
        `${townKey}'s stowhand is ${tileDistance(stowhand, crate)} tiles from its crate`,
      ).toBeLessThanOrEqual(2)
    })

    it(`${townKey}: the stowhand does not stand on the crate itself`, () => {
      const crate = crates[0]
      const stowhand = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-stowhand'))
      if (!crate || !stowhand) return
      // Sharing a tile would make one of the two untappable.
      expect(tileDistance(stowhand, crate)).toBeGreaterThan(0)
    })

    it(`${townKey}: the crate's tier is one the puzzle actually knows`, () => {
      const crate = crates[0]
      if (!crate) return
      const screen = crate.reactions.find(r => r.type === 'screen')
      expect(screen).toBeTruthy()
      if (!screen || screen.type !== 'screen') return
      const tierId = screen.screen === 'hub-stowage-hold' ? 'hold'
        : screen.screen === 'hub-stowage-wagon' ? 'wagon'
        : 'handcart'
      expect(STOWAGE_TIERS.map(t => t.id)).toContain(tierId)
    })

    it(`${townKey}: the crate does not collide with another interactable`, () => {
      const crate = crates[0]
      if (!crate) return
      const sharing = locationData.HUB_INTERACTABLES.filter(
        i => i.id !== crate.id && i.tx === crate.tx && i.ty === crate.ty)
      expect(sharing.map(i => i.id),
        `${townKey}'s crate shares a tile with another interactable`,
      ).toEqual([])
    })

    it(`${townKey}: the stowhand does not stand on another NPC or interactable`, () => {
      const stowhand = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-stowhand'))
      if (!stowhand) return
      const clashes = [
        ...locationData.EXTERIOR_NPCS.filter(n => n.id !== stowhand.id && n.tx === stowhand.tx && n.ty === stowhand.ty).map(n => n.id),
        ...locationData.HUB_INTERACTABLES.filter(i => i.tx === stowhand.tx && i.ty === stowhand.ty).map(i => i.id),
      ]
      expect(clashes, `${townKey}'s stowhand shares a tile`).toEqual([])
    })
  }

  it('spreads the three tiers across the realm rather than shipping one', () => {
    const tiers = Object.values(LOCATION_REGISTRY).flatMap(({ locationData }) =>
      locationData.HUB_INTERACTABLES.flatMap(i =>
        i.reactions.filter(r => r.type === 'screen' && STOWAGE_SCREENS.has(r.screen))
          .map(r => (r as { screen: string }).screen)))
    // Travelling for a harder crate and a better payout is the reason the tiers
    // are authored per town at all.
    expect(new Set(tiers).size).toBe(STOWAGE_TIERS.length)
  })

  it('gives every stowhand a name of their own', () => {
    const names = Object.values(LOCATION_REGISTRY).flatMap(({ locationData }) =>
      locationData.EXTERIOR_NPCS.filter(n => n.id.endsWith('-stowhand')).map(n => n.name))
    expect(new Set(names).size).toBe(names.length)
  })

  it("never gives a town's stowhand a sprite another of its puzzle NPCs wears", () => {
    for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
      const stowhand = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-stowhand'))
      if (!stowhand) continue
      for (const suffix of ['-cellarer', '-well-keeper']) {
        const other = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith(suffix))
        if (!other) continue
        // Three identical figures loitering in one town read as a rendering bug.
        expect(stowhand.sprite, `${townKey}'s stowhand and ${suffix.slice(1)} share a sprite`)
          .not.toBe(other.sprite)
      }
    }
  })
})

describe('the hook that opens every crate', () => {
  it('is on sale exactly once in the realm, in Millhaven', () => {
    const sellers = Object.entries(LOCATION_REGISTRY).flatMap(([townKey, { locationData }]) =>
      locationData.HUB_INTERACTABLES
        .filter(i => i.reactions.some(r => r.type === 'buyHubItem' && r.itemId === 'stevedores-hook'))
        .map(i => `${townKey}/${i.id}`))
    // The stowhand's line names Millhaven specifically, so it had better be the
    // only place that sells one.
    expect(sellers).toHaveLength(1)
    expect(sellers[0]).toContain('millhaven')
  })
})
