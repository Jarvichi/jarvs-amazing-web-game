import { describe, it, expect } from 'vitest'
import {
  roadCellRect, cellWear, pathFillParts, roadStrips,
  ROAD_LAYER_INSET, ROAD_LAYER_GAP,
} from './cityRoadGeometry'

// A 6×4 grid in a 608×408 wrapper makes the maths land on whole pixels:
//   avail = 608-8 = 600, cellW = (600 - 6*5)/6 = 95
//   avail = 408-8 = 400, cellH = (400 - 6*3)/4 = 95.5
const W = 608, H = 408, COLS = 6, ROWS = 4

describe('roadCellRect', () => {
  it('insets the layer and splits the remainder by the grid gap', () => {
    expect(roadCellRect(0, COLS, ROWS, W, H)).toEqual({
      x: ROAD_LAYER_INSET, y: ROAD_LAYER_INSET, w: 95, h: 95.5,
    })
  })

  it('steps by cell size plus gap across columns and down rows', () => {
    expect(roadCellRect(1, COLS, ROWS, W, H).x).toBe(4 + 95 + ROAD_LAYER_GAP)
    expect(roadCellRect(1, COLS, ROWS, W, H).y).toBe(4)
    // index 6 = row 1, col 0
    expect(roadCellRect(COLS, COLS, ROWS, W, H).x).toBe(4)
    expect(roadCellRect(COLS, COLS, ROWS, W, H).y).toBe(4 + 95.5 + ROAD_LAYER_GAP)
  })

  it('leaves the same inset on the far edge as the near one', () => {
    const last = roadCellRect(COLS * ROWS - 1, COLS, ROWS, W, H)
    expect(last.x + last.w).toBeCloseTo(W - ROAD_LAYER_INSET, 6)
    expect(last.y + last.h).toBeCloseTo(H - ROAD_LAYER_INSET, 6)
  })
})

describe('cellWear', () => {
  // h[i] = wear between cell i and i+1; v[i] = between cell i and i+cols.
  const h = Array.from({ length: 24 }, (_, i) => i * 10)
  const v = Array.from({ length: 24 }, (_, i) => i * 100)

  it('reads the shared edges either side of an interior cell', () => {
    expect(cellWear(7, COLS, ROWS, h, v)).toEqual({
      left: 60, right: 70, top: 100, bottom: 700,
    })
  })

  it('reports no wear across the outer boundary of the grid', () => {
    // Cell 0 is the top-left corner: nothing to its left or above it.
    expect(cellWear(0, COLS, ROWS, h, v)).toMatchObject({ left: 0, top: 0 })
    // Cell 23 is bottom-right: nothing to its right or below it.
    expect(cellWear(23, COLS, ROWS, h, v)).toMatchObject({ right: 0, bottom: 0 })
  })

  it('treats missing entries as unworn rather than NaN', () => {
    expect(cellWear(7, COLS, ROWS, [], [])).toEqual({ left: 0, right: 0, top: 0, bottom: 0 })
  })
})

describe('pathFillParts', () => {
  it('maps an unworn path to the dark end of the ramp', () => {
    expect(pathFillParts(0)).toEqual({ color: 0x8c6428, alpha: 0.25 })
  })

  it('maps a fully worn path to the pale end', () => {
    expect(pathFillParts(100)).toEqual({ color: 0xaa9b6e, alpha: 0.7 })
  })

  it('clamps wear above 100 rather than overshooting the ramp', () => {
    expect(pathFillParts(500)).toEqual(pathFillParts(100))
  })

  it('makes junction highlights more opaque than the strips they cross', () => {
    expect(pathFillParts(50, true).alpha).toBeGreaterThan(pathFillParts(50).alpha)
    // Same hue — only the alpha differs.
    expect(pathFillParts(50, true).color).toBe(pathFillParts(50).color)
  })
})

describe('roadStrips', () => {
  const rect = { x: 100, y: 200, w: 100, h: 100 }  // 1 viewBox unit = 1px
  const noWear = { left: 0, right: 0, top: 0, bottom: 0 }

  it('draws nothing for a cell with no roads touching it', () => {
    expect(roadStrips(noWear, rect)).toEqual([])
  })

  it('straddles the bottom boundary with a horizontal strip that spills into the gap', () => {
    const [strip] = roadStrips({ ...noWear, right: 100 }, rect)
    // Starts 5px before the cell's bottom edge (300) and runs 20px, so 15px
    // land in the gap below — that overhang is what bridges the 6px CSS gap.
    expect(strip).toMatchObject({ x: 100 - 12, y: 200 + 95, w: 124, h: 20 })
  })

  it('straddles the right boundary with a vertical strip', () => {
    const [strip] = roadStrips({ ...noWear, bottom: 100 }, rect)
    expect(strip).toMatchObject({ x: 100 + 95, y: 200 - 12, w: 20, h: 124 })
  })

  it('adds a highlighted square where the two strips cross', () => {
    const strips = roadStrips({ left: 50, right: 0, top: 80, bottom: 0 }, rect)
    expect(strips).toHaveLength(3)
    const junction = strips[2]
    expect(junction).toMatchObject({ x: 195, y: 295, w: 20, h: 20 })
    // Junction takes the heavier of the two wear levels, and is drawn brighter.
    expect(junction.alpha).toBe(pathFillParts(80, true).alpha)
  })

  it('takes the heavier wear of the two edges a strip represents', () => {
    const [strip] = roadStrips({ ...noWear, left: 20, right: 90 }, rect)
    expect(strip.color).toBe(pathFillParts(90).color)
  })

  it('scales each axis independently, as preserveAspectRatio="none" did', () => {
    const wide = { x: 0, y: 0, w: 200, h: 50 }
    const [strip] = roadStrips({ ...noWear, right: 100 }, wide)
    expect(strip.h).toBe(20 * 0.5)   // 20 viewBox units × (50/100)
    expect(strip.w).toBe(124 * 2)    // 124 viewBox units × (200/100)
  })
})
