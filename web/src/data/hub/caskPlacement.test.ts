import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { CASK_TIERS } from '../../components/minigames/CaskSounding.logic'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// Guard for Cask Sounding's only entrance (docs/minigame-cask-sounding.md §5).
// The game is reached by tapping a town's barrel and nowhere else, so a town
// missing its cask interactable — or a cellarer who ended up somewhere the
// player never walks — is the whole feature quietly invisible in that town,
// with nothing at runtime to complain about it.

const CASK_SCREENS = new Set([
  'hub-casks',
  'hub-casks-cellar',
  'hub-casks-vault',
])

/** The loader resolves a decor entry's tileId name to its numeric chip id. */
const BARREL_TILE = BASE_CHIP_TILES.barrel

/** Chebyshev distance, matching how the hub measures proximity everywhere. */
function tileDistance(a: { tx: number; ty: number }, b: { tx: number; ty: number }): number {
  return Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty))
}

describe('every town has a cellar', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
    const casks = locationData.HUB_INTERACTABLES.filter(i =>
      i.reactions.some(r => r.type === 'screen' && CASK_SCREENS.has(r.screen)))

    it(`${townKey}: exactly one barrel opening a cask screen`, () => {
      expect(casks).toHaveLength(1)
    })

    it(`${townKey}: the hatch sits on a barrel tile`, () => {
      const hatch = casks[0]
      if (!hatch) return
      // Overlays existing decor: a hitRect over scenery already in the town,
      // the same way forage spots overlay an existing bush.
      const onDecor = locationData.EXTERIOR_DECOR.some(
        d => d.tx === hatch.tx && d.ty === hatch.ty && d.tileId === BARREL_TILE)
      expect(onDecor,
        `${townKey}'s cask interactable is at (${hatch.tx}, ${hatch.ty}) with no barrel drawn there`,
      ).toBe(true)
    })

    it(`${townKey}: a cellarer stands beside the casks to point at them`, () => {
      const hatch = casks[0]
      if (!hatch) return
      const cellarers = locationData.EXTERIOR_NPCS.filter(n => n.id.endsWith('-cellarer'))
      expect(cellarers, `${townKey} has no *-cellarer in EXTERIOR_NPCS`).toHaveLength(1)
      const cellarer = cellarers[0]
      // HubWorld matches cellarers by this id suffix rather than a list, so the
      // suffix is load-bearing: rename it and the town silently loses its nudge.
      expect(cellarer.id.endsWith('-cellarer')).toBe(true)
      expect(cellarer.name).toBeTruthy()
      expect(cellarer.dialogue?.length ?? 0).toBeGreaterThan(0)
      // Within the cellarer's own near-bubble range of the casks they talk about.
      expect(tileDistance(cellarer, hatch),
        `${townKey}'s cellarer is ${tileDistance(cellarer, hatch)} tiles from its casks`,
      ).toBeLessThanOrEqual(2)
    })

    it(`${townKey}: the cellarer does not stand on the casks themselves`, () => {
      const hatch = casks[0]
      const cellarer = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-cellarer'))
      if (!hatch || !cellarer) return
      // Sharing a tile would make one of the two untappable.
      expect(tileDistance(cellarer, hatch)).toBeGreaterThan(0)
    })

    it(`${townKey}: the cellar's tier is one the puzzle actually knows`, () => {
      const hatch = casks[0]
      if (!hatch) return
      const screen = hatch.reactions.find(r => r.type === 'screen')
      expect(screen).toBeTruthy()
      if (!screen || screen.type !== 'screen') return
      const tierId = screen.screen === 'hub-casks-vault' ? 'vault'
        : screen.screen === 'hub-casks-cellar' ? 'cellar'
        : 'taproom'
      expect(CASK_TIERS.map(t => t.id)).toContain(tierId)
    })

    it(`${townKey}: the casks do not collide with another interactable`, () => {
      const hatch = casks[0]
      if (!hatch) return
      const sharing = locationData.HUB_INTERACTABLES.filter(
        i => i.id !== hatch.id && i.tx === hatch.tx && i.ty === hatch.ty)
      expect(sharing.map(i => i.id),
        `${townKey}'s casks share a tile with another interactable`,
      ).toEqual([])
    })
  }

  it('spreads the three tiers across the realm rather than shipping one', () => {
    const tiers = Object.values(LOCATION_REGISTRY).flatMap(({ locationData }) =>
      locationData.HUB_INTERACTABLES.flatMap(i =>
        i.reactions.filter(r => r.type === 'screen' && CASK_SCREENS.has(r.screen))
          .map(r => (r as { screen: string }).screen)))
    // Travelling for a harder cellar and a better payout is the reason the
    // tiers are authored per town at all.
    expect(new Set(tiers).size).toBe(CASK_TIERS.length)
  })

  it('gives every cellarer a name of their own', () => {
    const names = Object.values(LOCATION_REGISTRY).flatMap(({ locationData }) =>
      locationData.EXTERIOR_NPCS.filter(n => n.id.endsWith('-cellarer')).map(n => n.name))
    expect(new Set(names).size).toBe(names.length)
  })

  it("never gives a town's cellarer the same sprite as its well keeper", () => {
    for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
      const cellarer = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-cellarer'))
      const keeper = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith('-well-keeper'))
      if (!cellarer || !keeper) continue
      // Two identical figures loitering in one town read as a rendering bug.
      expect(cellarer.sprite, `${townKey}'s cellarer and well keeper share a sprite`)
        .not.toBe(keeper.sprite)
    }
  })
})

describe('the mallet that opens every cellar', () => {
  it('is on sale exactly once in the realm', () => {
    const sellers = Object.entries(LOCATION_REGISTRY).flatMap(([townKey, { locationData }]) =>
      locationData.HUB_INTERACTABLES
        .filter(i => i.reactions.some(r => r.type === 'buyHubItem' && r.itemId === 'coopers-mallet'))
        .map(i => `${townKey}/${i.id}`))
    // The cellarer's line names Appleford specifically, so it had better be the
    // only place that sells one.
    expect(sellers).toHaveLength(1)
    expect(sellers[0]).toContain('appleford')
  })
})
