/**
 * `web/src/data/cards.json` is loaded as plain JSON and cast to typed
 * interfaces (see `cards.ts`) — nothing structurally validates it against
 * `StructureEffect` et al. at build time. This file is the guard for shapes
 * TypeScript's cast can't catch, so a bad card ships as a data typo instead
 * of a silent runtime bug like #2297 (a `repairAura` missing `intervalMs`
 * turned its spawnTimer into `NaN` forever, from the second pulse onward).
 */
import { describe, it, expect } from 'vitest'
import { getCardCatalog } from './cards'
import { StructureEffect } from './types'

const TIMED_EFFECTS: StructureEffect['type'][] = ['spawn', 'healAura', 'repairAura']

describe('cards.json structural integrity', () => {
  it('gives every timed structure effect a positive intervalMs', () => {
    const offenders: string[] = []
    for (const card of getCardCatalog()) {
      const effect = card.unit?.structureEffect
      if (!effect || !(TIMED_EFFECTS as string[]).includes(effect.type)) continue
      const intervalMs = (effect as { intervalMs?: number }).intervalMs
      if (typeof intervalMs !== 'number' || intervalMs <= 0) offenders.push(card.name)
    }
    expect(offenders, `cards with an invalid/missing intervalMs: ${offenders.join(', ')}`).toEqual([])
  })

  it('gives every spawner a unit template to spawn', () => {
    const offenders: string[] = []
    for (const card of getCardCatalog()) {
      const effect = card.unit?.structureEffect
      if (effect?.type !== 'spawn') continue
      if (!effect.unitTemplate || typeof effect.unitTemplate.maxHp !== 'number') offenders.push(card.name)
    }
    expect(offenders, `spawners with no resolved unit template: ${offenders.join(', ')}`).toEqual([])
  })
})
