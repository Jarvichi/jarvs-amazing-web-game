import { describe, it, expect } from 'vitest'
import { LOCATION_REGISTRY } from './hubWorldFactory'

// Regression sentinel for the player-house authoring trap (see docs/hubworld.md
// §10/§13): a building can be tagged `requiresOwnership`/`upgradeKind` without
// its matching interior ever getting `playerDecor`, which purchases fine but
// never renders placed furniture — or `requiresOwnership` without an
// `upgradeKind` track, which can never be purchased at all. Runs against every
// real town's parsed data (not synthetic fixtures), so it would have caught
// the original Millhaven/Ravenwatch/Capital City bug and catches recurrences,
// including ones introduced by hand-editing config.json outside the map editor.
describe('player-house tag consistency (all towns)', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
    for (const building of locationData.HUB_BUILDINGS) {
      const label = `${townKey}/${building.id ?? '(no id)'}`

      if (building.requiresOwnership) {
        it(`${label}: requiresOwnership implies a purchase track (upgradeKind)`, () => {
          expect(building.upgradeKind, `${label} has requiresOwnership but no upgradeKind — its door can never be purchased/unlocked`).toBeTruthy()
        })
      }

      if (building.upgradeKind === 'playerHouse') {
        it(`${label}: playerHouse building has a matching interior with playerDecor`, () => {
          const interior = building.id ? locationData.HUB_INTERIORS[building.id] : undefined
          expect(interior, `${label} has no matching interior keyed by its own id`).toBeTruthy()
          expect(interior?.playerDecor, `${label}'s interior is missing playerDecor — placed furniture will never render`).toBe(true)
        })
      }
    }

    // Every minLevel-gated exit (e.g. a purchasable second room) must point at
    // an interior that actually exists — otherwise the door opens onto nothing.
    for (const [interiorId, interior] of Object.entries(locationData.HUB_INTERIORS)) {
      for (const exit of interior.exits ?? []) {
        if (exit.minLevel === undefined) continue
        it(`${townKey}/${interiorId}: minLevel-gated exit "${exit.label ?? exit.toInteriorId}" targets a real interior`, () => {
          expect(locationData.HUB_INTERIORS[exit.toInteriorId], `${townKey}/${interiorId}'s exit to "${exit.toInteriorId}" has no matching interior`).toBeTruthy()
        })
      }
    }
  }
})
