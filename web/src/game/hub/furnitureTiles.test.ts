import { describe, it, expect } from 'vitest'
import { getFurnitureTileOffsets } from './furnitureTiles'
import { shelfItemDisplayId, shelfRelicDisplayId } from './shelfDecor'

describe('getFurnitureTileOffsets', () => {
  it('resolves a known furniture id to its authored offsets', () => {
    expect(getFurnitureTileOffsets('reading-lamp')).toEqual([{ dx: 0, dy: 0, tileId: expect.any(Number) }])
    expect(getFurnitureTileOffsets('cozy-rug')).toHaveLength(4)
  })

  it('returns nothing for an unknown, non-shelf-decor id', () => {
    expect(getFurnitureTileOffsets('not-a-real-item')).toEqual([])
  })

  it('resolves any shelf-decor id to a single generic display tile', () => {
    const itemOffsets = getFurnitureTileOffsets(shelfItemDisplayId('trinket-1'))
    const relicOffsets = getFurnitureTileOffsets(shelfRelicDisplayId('Bark Shield'))
    expect(itemOffsets).toEqual([{ dx: 0, dy: 0, tileId: expect.any(Number) }])
    expect(relicOffsets).toEqual(itemOffsets)
  })
})
