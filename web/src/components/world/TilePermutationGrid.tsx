import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { renderPathTiles } from '../../utils/tileLookup'
import { TILE_SIZE } from '../../data/tiles/tileIndex'

const T = TILE_SIZE
const STAMP_TILES = 4   // 3×3 neighbor footprint + 1 gap tile between stamps
const COLS = 8

type Dir = 'N' | 'E' | 'S' | 'W' | 'NE' | 'SE' | 'SW' | 'NW'
type Scenario = Record<Dir, boolean>

/**
 * Every canonical 8-neighbor mask buildTileLookup() can ever produce: 16
 * cardinal combinations × every diagonal combination that's actually reachable
 * for that combination (a diagonal only varies independently when both of its
 * adjacent cardinals are present). Always 47 entries — matches the 47 painted
 * tiles in a `[A]_type3` sheet.
 */
function buildAllScenarios(): Scenario[] {
  const scenarios: Scenario[] = []
  for (let c = 0; c < 16; c++) {
    const N = !!(c & 1), E = !!(c & 2), S = !!(c & 4), W = !!(c & 8)
    const diagSlots: Array<[Dir, boolean]> = [['NE', N && E], ['SE', S && E], ['SW', S && W], ['NW', N && W]]
    const activeDiags = diagSlots.filter(([, active]) => active).map(([dir]) => dir)
    for (let d = 0; d < 1 << activeDiags.length; d++) {
      const s: Scenario = { N, E, S, W, NE: false, SE: false, SW: false, NW: false }
      activeDiags.forEach((dir, i) => { s[dir] = !!(d & (1 << i)) })
      scenarios.push(s)
    }
  }
  return scenarios
}

const SCENARIOS = buildAllScenarios()

const NEIGHBOR_OFFSET: Record<Dir, [number, number]> = {
  N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0],
  NE: [1, -1], SE: [1, 1], SW: [-1, 1], NW: [-1, -1],
}

interface Props {
  /** One of `PATH_TILE.*` — the per-combination 8×6 sheet to exercise. */
  tileFile: string
  /** Canal/water mode: wide paths + the concave-corner shoreline accent. */
  useCanal?: boolean
  /** CSS pixel scale applied to the whole grid (tiles render at 32px natively). */
  scale?: number
}

/**
 * Renders every reachable 8-neighbor tile shape (isolated, lines, turns,
 * T-junctions, all-sides, and — in canal mode — every missing-diagonal
 * combination of the concave shoreline corner) through the real
 * `renderPathTiles()` so a tileset/lookup-table change can be eyeballed for
 * regressions across all 47 shapes at once, instead of waiting to encounter
 * each one in a live map.
 */
export function TilePermutationGrid({ tileFile, useCanal, scale = 2 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rows = Math.ceil(SCENARIOS.length / COLS)
  const width = COLS * STAMP_TILES * T
  const height = rows * STAMP_TILES * T

  usePixiApp(containerRef, width, height, (app) => {
    const root = new PIXI.Container()
    app.stage.addChild(root)

    const bgLayer    = new PIXI.Graphics()
    const tilesLayer = new PIXI.Container()
    const labelLayer = new PIXI.Container()
    root.addChild(bgLayer, tilesLayer, labelLayer)

    const pathSet = new Set<string>()
    const stamps: Array<{ originX: number; originY: number; cx: number; cy: number; label: string }> = []

    SCENARIOS.forEach((s, i) => {
      const originX = (i % COLS) * STAMP_TILES
      const originY = Math.floor(i / COLS) * STAMP_TILES
      const cx = originX + 1
      const cy = originY + 1
      pathSet.add(`${cx},${cy}`)
      for (const [dir, [dx, dy]] of Object.entries(NEIGHBOR_OFFSET) as Array<[Dir, [number, number]]>) {
        if (s[dir]) pathSet.add(`${cx + dx},${cy + dy}`)
      }
      const label = (Object.keys(NEIGHBOR_OFFSET) as Dir[]).filter(d => s[d]).join(' ') || '(isolated)'
      stamps.push({ originX, originY, cx, cy, label })

      bgLayer
        .rect(originX * T, originY * T, 3 * T, 3 * T)
        .fill({ color: 0x1f3d1f })
    })

    renderPathTiles(tilesLayer, pathSet, undefined, tileFile, useCanal).then(() => {
      for (const { originX, originY, label } of stamps) {
        const text = new PIXI.Text({
          text: label,
          style: { fontSize: 9, fill: '#ffe066', fontFamily: 'monospace' },
        })
        text.anchor.set(0.5, 0)
        text.position.set(originX * T + (3 * T) / 2, (originY + 3) * T + 2)
        labelLayer.addChild(text)
      }
    })
  })

  return (
    <div
      ref={containerRef}
      style={{
        width: width * scale,
        height: height * scale,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        imageRendering: 'pixelated',
      }}
    />
  )
}
