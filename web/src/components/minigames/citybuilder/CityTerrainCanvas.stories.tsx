import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityTerrainCanvas } from './CityTerrainCanvas'

const meta = {
  component: CityTerrainCanvas,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      // City grid proportions: roughly square, larger than battlefield
      <div style={{ width: 480, height: 480, position: 'relative', border: '1px solid #333' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CityTerrainCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Farmland: Story = { args: { environment: 'farmland', id: 'city-farmland' } }
export const Forest:   Story = { args: { environment: 'forest',   id: 'city-forest'   } }
export const Ruins:    Story = { args: { environment: 'ruins',    id: 'city-ruins'     } }
export const Ashen:    Story = { args: { environment: 'ashen',    id: 'city-ashen'     } }
export const Sand:     Story = { args: { environment: 'sand',     id: 'city-sand'      } }
export const Volcano:  Story = { args: { environment: 'volcano',  id: 'city-volcano'   } }
export const Citadel:  Story = { args: { environment: 'citadel',  id: 'city-citadel'   } }
export const Coast:    Story = { args: { environment: 'coast',    id: 'city-coast'     } }
export const Frost:    Story = { args: { environment: 'frost',    id: 'city-frost'     } }

// ── Road wear ─────────────────────────────────────────────────────────────────
// A 6×4 grid, matching CITY_COLS × CITY_ROWS. h[i] is the edge between cell i
// and i+1; v[i] the edge between cell i and i+6. Strips are drawn on each
// cell's bottom/right boundary, so they land in the grid gap.

const COLS = 6, ROWS = 4, CELLS = COLS * ROWS
const noWear = () => new Array(CELLS).fill(0)

const withWear = (h: number[], v: number[]) => ({
  environment: 'farmland', id: 'city-roads', cols: COLS, rows: ROWS, roadWear: { h, v },
})

/** Top row fully worn left-to-right — a horizontal stripe under row 0. */
export const RoadsHorizontal: Story = {
  args: withWear(noWear().map((_, i) => (i < COLS - 1 ? 100 : 0)), noWear()),
}

/** Left column fully worn top-to-bottom — a vertical stripe right of col 0. */
export const RoadsVertical: Story = {
  args: withWear(noWear(), noWear().map((_, i) => (i % COLS === 0 && i < COLS * (ROWS - 1) ? 100 : 0))),
}

/** Crossing roads, so the brighter junction patches are visible. */
export const RoadsJunction: Story = {
  args: withWear(
    noWear().map((_, i) => (Math.floor(i / COLS) === 1 && i % COLS < COLS - 1 ? 100 : 0)),
    noWear().map((_, i) => (i % COLS === 2 && i < COLS * (ROWS - 1) ? 100 : 0)),
  ),
}

/** The full wear ramp, faintest to heaviest, one level per column. */
export const RoadsWearRamp: Story = {
  args: withWear(
    noWear().map((_, i) => (Math.floor(i / COLS) === 1 && i % COLS < COLS - 1 ? (i % COLS + 1) * 20 : 0)),
    noWear(),
  ),
}
