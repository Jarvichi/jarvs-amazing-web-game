import { describe, it, expect } from 'vitest'
import { nodeCenter, snapToTile } from './nodeLayout'
import { TILE_SIZE } from '../../../data/tiles/tileIndex'

// Node markers, road tiles and connector beziers are all placed off nodeCenter.
// Road tiles are laid at floor(y / TILE_SIZE), so a node centre that is not on a
// tile centre renders up to half a tile away from its own path — which is what
// used to happen to every row whose rowCols parity differed from maxRowCols.
const onTileCentre = (v: number) => ((v % TILE_SIZE) + TILE_SIZE) % TILE_SIZE === TILE_SIZE / 2

describe('snapToTile', () => {
  it('maps any point to the centre of the tile containing it', () => {
    expect(snapToTile(0)).toBe(16)
    expect(snapToTile(16)).toBe(16)
    expect(snapToTile(31)).toBe(16)
    expect(snapToTile(32)).toBe(48)
    expect(snapToTile(96)).toBe(112)
  })
})

describe('nodeCenter', () => {
  it('lands on a tile centre for rows matching maxRowCols parity', () => {
    for (const col of [0, 1, 2, 3]) {
      const { x, y } = nodeCenter(2, col, 4, 4)
      expect(onTileCentre(x)).toBe(true)
      expect(onTileCentre(y)).toBe(true)
    }
  })

  // The regression: rowCols 3 inside maxRowCols 4 offsets the row by half a
  // cell, which used to put node centres on a tile boundary 16px off the road.
  it('lands on a tile centre for parity-mismatched rows', () => {
    for (const col of [0, 1, 2]) {
      const { x, y } = nodeCenter(1, col, 3, 4)
      expect(onTileCentre(x)).toBe(true)
      expect(onTileCentre(y)).toBe(true)
    }
  })

  it('covers every row shape the shipped acts use', () => {
    for (let maxRowCols = 1; maxRowCols <= 6; maxRowCols++) {
      for (let rowCols = 1; rowCols <= maxRowCols; rowCols++) {
        for (let col = 0; col < rowCols; col++) {
          for (const ri of [0, 1, 5]) {
            const { x, y } = nodeCenter(ri, col, rowCols, maxRowCols)
            expect(onTileCentre(x)).toBe(true)
            expect(onTileCentre(y)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps distinct columns on distinct tiles', () => {
    const a = nodeCenter(0, 0, 4, 4).y
    const b = nodeCenter(0, 1, 4, 4).y
    expect(a).not.toBe(b)
  })
})
