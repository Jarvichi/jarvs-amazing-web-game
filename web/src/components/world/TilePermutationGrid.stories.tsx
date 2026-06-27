import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TilePermutationGrid } from './TilePermutationGrid'
import { PATH_TILE } from '../../data/tiles/tileIndex'

const meta = {
  component: TilePermutationGrid,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ overflow: 'auto', width: '100vw', height: '100vh', background: '#0a0a0a' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TilePermutationGrid>

export default meta
type Story = StoryObj<typeof meta>

// ── Ponds / canals (wide-path lookup) ─────────────────────────────────────────
// useCanal:true exercises CANAL_TILE_LOOKUP plus the concave-corner shoreline
// accent — every missing-diagonal combination of the "fully surrounded by
// water" mask should now show a shoreline wedge instead of a flat hole.

export const Water1Pond: Story = { name: 'Pond / Water1', args: { tileFile: PATH_TILE.water1, useCanal: true } }
export const Water2Pond: Story = { name: 'Pond / Water2', args: { tileFile: PATH_TILE.water2, useCanal: true } }
export const Water3Pond: Story = { name: 'Pond / Water3', args: { tileFile: PATH_TILE.water3, useCanal: true } }
export const Water4Pond: Story = { name: 'Pond / Water4', args: { tileFile: PATH_TILE.water4, useCanal: true } }
export const Water5Pond: Story = { name: 'Pond / Water5', args: { tileFile: PATH_TILE.water5, useCanal: true } }
export const Water6Pond: Story = { name: 'Pond / Water6', args: { tileFile: PATH_TILE.water6, useCanal: true } }
export const Water7Pond: Story = { name: 'Pond / Water7', args: { tileFile: PATH_TILE.water7, useCanal: true } }

// ── Paths (single-tile-wide lookup, no corner accent) ────────────────────────

export const Dirt1Path: Story        = { name: 'Path / Dirt1',          args: { tileFile: PATH_TILE.dirt1 } }
export const Dirt4Path: Story        = { name: 'Path / Dirt4',          args: { tileFile: PATH_TILE.dirt4 } }
export const Dirt1Dirt4Path: Story   = { name: 'Path / Dirt1-Dirt4',    args: { tileFile: PATH_TILE.dirt1Dirt4 } }
export const Grass1Dirt1Path: Story  = { name: 'Path / Grass1-Dirt1',   args: { tileFile: PATH_TILE.grass1Dirt1 } }
export const Grass1Dirt2Path: Story  = { name: 'Path / Grass1-Dirt2',   args: { tileFile: PATH_TILE.grass1Dirt2 } }
export const Grass1Dirt3Path: Story  = { name: 'Path / Grass1-Dirt3',   args: { tileFile: PATH_TILE.grass1Dirt3 } }
export const Grass1Dirt4Path: Story  = { name: 'Path / Grass1-Dirt4',   args: { tileFile: PATH_TILE.grass1Dirt4 } }
export const Grass1Grass2Path: Story = { name: 'Path / Grass1-Grass2',  args: { tileFile: PATH_TILE.grass1Grass2 } }
export const Grass1Grass3Path: Story = { name: 'Path / Grass1-Grass3',  args: { tileFile: PATH_TILE.grass1Grass3 } }
export const Grass1Grass4Path: Story = { name: 'Path / Grass1-Grass4',  args: { tileFile: PATH_TILE.grass1Grass4 } }
export const Wall1Path: Story        = { name: 'Path / Wall-Up1',       args: { tileFile: PATH_TILE.wall1 } }
export const Wall2Path: Story        = { name: 'Path / Wall-Up2',       args: { tileFile: PATH_TILE.wall2 } }
export const FlowerPath: Story       = { name: 'Path / Flower',         args: { tileFile: PATH_TILE.flower1 } }
export const LongGrassPath: Story    = { name: 'Path / LongGrass',      args: { tileFile: PATH_TILE.longGrass } }
