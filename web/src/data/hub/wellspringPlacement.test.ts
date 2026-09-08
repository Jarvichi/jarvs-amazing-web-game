import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { WELLSPRING_DEPTHS } from '../../components/minigames/Wellspring.logic'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// Guard for the Wellspring puzzle's only entrance (docs/minigame-wellspring.md
// §5). The game is reached by tapping a town's well and nowhere else, so a
// town missing its well interactable — or a keeper NPC that never gets a
// proximity bubble because it ended up somewhere the player never walks — is
// the whole feature quietly invisible in that town, with nothing at runtime to
// complain about it.

const WELL_SCREENS = new Set([
  'hub-wellspring',
  'hub-wellspring-deep',
  'hub-wellspring-vault',
])

/** The loader resolves a decor entry's tileId name to its numeric chip id. */
const STONE_WELL_TILE = BASE_CHIP_TILES.stoneWell

/** Chebyshev distance, matching how the hub measures proximity everywhere. */
function tileDistance(a: { tx: number; ty: number }, b: { tx: number; ty: number }): number {
  return Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty))
}

describe('every town has a wellspring', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
    const wells = locationData.HUB_INTERACTABLES.filter(i =>
      i.reactions.some(r => r.type === 'screen' && WELL_SCREENS.has(r.screen)))

    it(`${townKey}: exactly one well opening a wellspring screen`, () => {
      expect(wells).toHaveLength(1)
    })

    it(`${townKey}: the well sits on a stoneWell tile`, () => {
      const well = wells[0]
      if (!well) return
      // Overlays existing well decor: a hitRect over scenery already in the
      // town, the same way forage spots overlay an existing bush.
      const onDecor = locationData.EXTERIOR_DECOR.some(
        d => d.tx === well.tx && d.ty === well.ty && d.tileId === STONE_WELL_TILE)
      expect(onDecor,
        `${townKey}'s well interactable is at (${well.tx}, ${well.ty}) with no stoneWell drawn there`,
      ).toBe(true)
    })

    it(`${townKey}: a keeper stands beside the well to point at it`, () => {
      const well = wells[0]
      if (!well) return
      const keepers = locationData.EXTERIOR_NPCS.filter(n => n.id.endsWith('-well-keeper'))
      expect(keepers, `${townKey} has no *-well-keeper in EXTERIOR_NPCS`).toHaveLength(1)
      const keeper = keepers[0]
      // HubWorld matches keepers by this id suffix rather than a list, so the
      // suffix is load-bearing: rename it and the town silently loses its nudge.
      expect(keeper.id.endsWith('-well-keeper')).toBe(true)
      expect(keeper.name).toBeTruthy()
      expect(keeper.dialogue?.length ?? 0).toBeGreaterThan(0)
      // Within the keeper's own near-bubble range of the well it talks about.
      expect(tileDistance(keeper, well),
        `${townKey}'s keeper is ${tileDistance(keeper, well)} tiles from its well`,
      ).toBeLessThanOrEqual(2)
    })

    it(`${townKey}: the well's depth is one the puzzle actually knows`, () => {
      const well = wells[0]
      if (!well) return
      const screen = well.reactions.find(r => r.type === 'screen')
      expect(screen).toBeTruthy()
      if (!screen || screen.type !== 'screen') return
      const depthId = screen.screen === 'hub-wellspring-vault' ? 'vault'
        : screen.screen === 'hub-wellspring-deep' ? 'deep'
        : 'shallow'
      expect(WELLSPRING_DEPTHS.map(d => d.id)).toContain(depthId)
    })
  }
})

describe('the crank that opens every well', () => {
  it('is on sale exactly once in the realm', () => {
    const sellers = Object.entries(LOCATION_REGISTRY).flatMap(([townKey, { locationData }]) =>
      locationData.HUB_INTERACTABLES
        .filter(i => i.reactions.some(r => r.type === 'buyHubItem' && r.itemId === 'winding-crank'))
        .map(i => `${townKey}/${i.id}`))
    // The keeper's line names Gearford specifically, so it had better be the
    // only place that sells one.
    expect(sellers).toHaveLength(1)
    expect(sellers[0]).toContain('gearford')
  })
})
