import { describe, it, expect } from 'vitest'
import {
  isSameType, isSameEntityRef, toggleInSelection, nextAreaId,
  convertStreetToPond, convertPondToStreet, applyDeleteEntities,
} from './multiSelectHelpers'
import type { SelectedEntity, RawMapConfig } from './mapEditorTypes'

const street0: SelectedEntity = { type: 'street', index: 0 }
const street1: SelectedEntity = { type: 'street', index: 1 }
const decor0: SelectedEntity  = { type: 'exteriorDecor', index: 0 }

describe('isSameType', () => {
  it('returns true for same type', () => expect(isSameType(street0, street1)).toBe(true))
  it('returns false for different types', () => expect(isSameType(street0, decor0)).toBe(false))
})

describe('isSameEntityRef', () => {
  it('returns true for identical ref', () => expect(isSameEntityRef(street0, { type: 'street', index: 0 })).toBe(true))
  it('returns false for same type different index', () => expect(isSameEntityRef(street0, street1)).toBe(false))
  it('returns false for interiorDecor with different interiorId', () => {
    const a: SelectedEntity = { type: 'interiorDecor', index: 0, interiorId: 'room-a' }
    const b: SelectedEntity = { type: 'interiorDecor', index: 0, interiorId: 'room-b' }
    expect(isSameEntityRef(a, b)).toBe(false)
  })
})

describe('toggleInSelection', () => {
  it('adds entity to empty selection', () => expect(toggleInSelection([], street0)).toEqual([street0]))
  it('adds same-type entity', () => expect(toggleInSelection([street0], street1)).toEqual([street0, street1]))
  it('removes entity already present', () => expect(toggleInSelection([street0, street1], street0)).toEqual([street1]))
  it('ignores different-type when non-empty', () => expect(toggleInSelection([street0], decor0)).toEqual([street0]))
  it('allows different type when selection is empty', () => expect(toggleInSelection([], decor0)).toEqual([decor0]))
})

describe('nextAreaId', () => {
  it('returns area-1 when empty', () => expect(nextAreaId([])).toBe('area-1'))
  it('increments past existing', () => expect(nextAreaId([{ id: 'area-1' }, { id: 'area-2' }])).toBe('area-3'))
  it('fills first gap', () => expect(nextAreaId([{ id: 'area-1' }, { id: 'area-3' }])).toBe('area-2'))
})

const baseConfig = {
  streets: [{ rect: [0, 0, 2, 2], pathType: 'cobble' }, { tile: [5, 5] }],
  pondTiles: [{ rect: [3, 3, 4, 4] }],
  exteriorDecor: [{ tx: 1, ty: 1, tileId: 'barrel', zlayer: 'solid' }, { tx: 2, ty: 2, tileId: 'crate', zlayer: 'solid' }],
  npcSpawnTiles: [[1, 1], [2, 2]],
} as unknown as RawMapConfig

describe('convertStreetToPond', () => {
  it('moves entry to pondTiles and drops pathType', () => {
    const result = convertStreetToPond(baseConfig, 0)!
    expect(result.config.streets).toHaveLength(1)
    expect(result.config.streets![0]).toEqual({ tile: [5, 5] })
    expect(result.config.pondTiles).toHaveLength(2)
    expect(result.config.pondTiles![1]).toEqual({ rect: [0, 0, 2, 2] })
    expect(result.pondIndex).toBe(1)
  })
  it('returns null for out-of-bounds index', () => expect(convertStreetToPond(baseConfig, 99)).toBeNull())
})

describe('convertPondToStreet', () => {
  it('moves entry to streets', () => {
    const result = convertPondToStreet(baseConfig, 0)!
    expect(result.config.pondTiles).toHaveLength(0)
    expect(result.config.streets).toHaveLength(3)
    expect(result.streetIndex).toBe(2)
  })
  it('returns null for out-of-bounds', () => expect(convertPondToStreet(baseConfig, 99)).toBeNull())
})

describe('applyDeleteEntities', () => {
  it('deletes single exteriorDecor', () => {
    const c = applyDeleteEntities(baseConfig, [decor0])
    expect(c.exteriorDecor).toHaveLength(1)
    expect(c.exteriorDecor![0].tileId).toBe('crate')
  })
  it('deletes multiple streets in one pass (no index shift)', () => {
    const c = applyDeleteEntities(baseConfig, [street0, street1])
    expect(c.streets).toHaveLength(0)
  })
  it('deletes npcSpawnTile', () => {
    const c = applyDeleteEntities(baseConfig, [{ type: 'npcSpawnTile', index: 0 }])
    expect(c.npcSpawnTiles).toHaveLength(1)
  })
  it('leaves unrelated data unchanged', () => {
    const c = applyDeleteEntities(baseConfig, [street0])
    expect(c.pondTiles).toHaveLength(1)
    expect(c.exteriorDecor).toHaveLength(2)
  })
})
