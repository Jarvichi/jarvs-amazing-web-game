import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TileBrowser, TilesetDef } from './TileBrowser'
import { PATH, GRASS_PATH, SCENERY } from '../../data/tiles/tileIndex'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'

const meta = {
  component: TileBrowser,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ overflowY: 'auto', height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TileBrowser>

export default meta
type Story = StoryObj<typeof meta>

// ── SampleMap (big sheets) ────────────────────────────────────────────────────

const BASE_PATH = '/world/SampleMap/'

const SAMPLE_TILESETS: Record<string, TilesetDef> = {
  BaseChip:    { name: '[Base]BaseChip_pipo', image: `${BASE_PATH}[Base]BaseChip_pipo.png`,  tilecount: 1064, columns: 8  },
  Grass:       { name: '[A]Grass_pipo',       image: `${BASE_PATH}[A]Grass_pipo.png`,        tilecount: 528,  columns: 8  },
  Dirt:        { name: '[A]Dirt_pipo',        image: `${BASE_PATH}[A]Dirt_pipo.png`,         tilecount: 336,  columns: 8  },
  Flower:      { name: '[A]Flower_pipo',      image: `${BASE_PATH}[A]Flower_pipo.png`,       tilecount: 48,   columns: 8  },
  WallUp:      { name: '[A]Wall-Up_pipo',     image: `${BASE_PATH}[A]Wall-Up_pipo.png`,      tilecount: 96,   columns: 8  },
  Water:       { name: '[A]Water_pipo',       image: `${BASE_PATH}[A]Water_pipo.png`,        tilecount: 3072, columns: 64 },
  WaterFall:   { name: '[A]WaterFall_pipo',   image: `${BASE_PATH}[A]WaterFall_pipo.png`,    tilecount: 576,  columns: 32 },
  LightShadow: { name: 'LightShadow_pipo',    image: `${BASE_PATH}LightShadow_pipo.png`,     tilecount: 48,   columns: 8  },
}

const BASE_CHIP_LABELS: Record<number, string> = {}
for (const [name, id] of Object.entries(BASE_CHIP_TILES)) {
  BASE_CHIP_LABELS[id] = BASE_CHIP_LABELS[id] ? `${BASE_CHIP_LABELS[id]} / ${name}` : name
}

const GRASS_LABELS: Record<number, string> = {}
for (const [setName, base] of Object.entries(GRASS_PATH)) {
  for (const [pathName, offset] of Object.entries(PATH)) {
    GRASS_LABELS[base + offset] = `${setName} · ${pathName}`
  }
  GRASS_LABELS[base + 47] = `— blank (end of ${setName}) —`
}

export const BaseChip: Story    = { args: { tileset: SAMPLE_TILESETS.BaseChip, labels: BASE_CHIP_LABELS } }
export const Grass: Story       = { args: { tileset: SAMPLE_TILESETS.Grass, labels: GRASS_LABELS } }
export const Dirt: Story        = { args: { tileset: SAMPLE_TILESETS.Dirt } }
export const Flower: Story      = { args: { tileset: SAMPLE_TILESETS.Flower } }
export const WallUp: Story      = { args: { tileset: SAMPLE_TILESETS.WallUp } }
export const Water: Story       = { args: { tileset: SAMPLE_TILESETS.Water } }
export const WaterFall: Story   = { args: { tileset: SAMPLE_TILESETS.WaterFall } }
export const LightShadow: Story = { args: { tileset: SAMPLE_TILESETS.LightShadow } }

// ── Type3 (per-combination, 8×6 = 47 tiles) ──────────────────────────────────

const T3 = '/world/[A]_type3/'

const PATH_LABELS: Record<number, string> = {
  ...Object.fromEntries(Object.entries(PATH).map(([name, id]) => [id, name])),
  47: '— blank —',
}

const SCENERY_LABELS: Record<number, string> = {
  ...Object.fromEntries(Object.entries(SCENERY).map(([name, id]) => [id, name])),
  47: '— blank —',
}

function t3(file: string): TilesetDef {
  return { name: file.replace('_pipo.png', ''), image: `${T3}${file}`, tilecount: 48, columns: 8 }
}

export const T3_Grass1: Story          = { name: 'Type3 / Grass1',          args: { tileset: t3('[A]Grass1_pipo.png'),          labels: PATH_LABELS } }
export const T3_Grass1_Dirt1: Story    = { name: 'Type3 / Grass1-Dirt1',    args: { tileset: t3('[A]Grass1-Dirt1_pipo.png'),    labels: PATH_LABELS } }
export const T3_Grass1_Dirt2: Story    = { name: 'Type3 / Grass1-Dirt2',    args: { tileset: t3('[A]Grass1-Dirt2_pipo.png'),    labels: PATH_LABELS } }
export const T3_Grass1_Dirt3: Story    = { name: 'Type3 / Grass1-Dirt3',    args: { tileset: t3('[A]Grass1-Dirt3_pipo.png'),    labels: PATH_LABELS } }
export const T3_Grass1_Dirt4: Story    = { name: 'Type3 / Grass1-Dirt4',    args: { tileset: t3('[A]Grass1-Dirt4_pipo.png'),    labels: PATH_LABELS } }
export const T3_Grass1_Grass2: Story   = { name: 'Type3 / Grass1-Grass2',   args: { tileset: t3('[A]Grass1-Grass2_pipo.png'),   labels: PATH_LABELS } }
export const T3_Grass1_Grass3: Story   = { name: 'Type3 / Grass1-Grass3',   args: { tileset: t3('[A]Grass1-Grass3_pipo.png'),   labels: PATH_LABELS } }
export const T3_Grass1_Grass4: Story   = { name: 'Type3 / Grass1-Grass4',   args: { tileset: t3('[A]Grass1-Grass4_pipo.png'),   labels: PATH_LABELS } }
export const T3_Grass2: Story          = { name: 'Type3 / Grass2',          args: { tileset: t3('[A]Grass2_pipo.png'),          labels: PATH_LABELS } }
export const T3_Grass3: Story          = { name: 'Type3 / Grass3',          args: { tileset: t3('[A]Grass3_pipo.png'),          labels: PATH_LABELS } }
export const T3_Grass4: Story          = { name: 'Type3 / Grass4',          args: { tileset: t3('[A]Grass4_pipo.png'),          labels: PATH_LABELS } }
export const T3_LongGrass: Story       = { name: 'Type3 / LongGrass',       args: { tileset: t3('[A]LongGrass_pipo.png'),       labels: PATH_LABELS } }
export const T3_Dirt1: Story           = { name: 'Type3 / Dirt1',           args: { tileset: t3('[A]Dirt1_pipo.png'),           labels: PATH_LABELS } }
export const T3_Dirt1_Dirt2: Story     = { name: 'Type3 / Dirt1-Dirt2',     args: { tileset: t3('[A]Dirt1-Dirt2_pipo.png'),     labels: PATH_LABELS } }
export const T3_Dirt1_Dirt3: Story     = { name: 'Type3 / Dirt1-Dirt3',     args: { tileset: t3('[A]Dirt1-Dirt3_pipo.png'),     labels: PATH_LABELS } }
export const T3_Dirt1_Dirt4: Story     = { name: 'Type3 / Dirt1-Dirt4',     args: { tileset: t3('[A]Dirt1-Dirt4_pipo.png'),     labels: PATH_LABELS } }
export const T3_Dirt2: Story           = { name: 'Type3 / Dirt2',           args: { tileset: t3('[A]Dirt2_pipo.png'),           labels: PATH_LABELS } }
export const T3_Dirt3: Story           = { name: 'Type3 / Dirt3',           args: { tileset: t3('[A]Dirt3_pipo.png'),           labels: PATH_LABELS } }
export const T3_Dirt4: Story           = { name: 'Type3 / Dirt4',           args: { tileset: t3('[A]Dirt4_pipo.png'),           labels: PATH_LABELS } }
export const T3_Flower: Story          = { name: 'Type3 / Flower',          args: { tileset: t3('[A]Flower_pipo.png'),          labels: PATH_LABELS } }
export const T3_WallUp1: Story         = { name: 'Type3 / Wall-Up1',        args: { tileset: t3('[A]Wall-Up1_pipo.png'),        labels: PATH_LABELS } }
export const T3_WallUp2: Story         = { name: 'Type3 / Wall-Up2',        args: { tileset: t3('[A]Wall-Up2_pipo.png'),        labels: PATH_LABELS } }

// Animated tiles: same 8×6 variant grid repeated once per frame horizontally.
// Water: 2048×192 = 64 cols (8 frames × 8 cols each). WaterFall: 1024×192 = 32 cols (4 frames).
// In each row: col % 8 = within-frame column, Math.floor(col / 8) + 1 = frame number.
function animatedPathLabels(totalColumns: number): Record<number, string> {
  const byVariant: Record<number, string> = {
    ...Object.fromEntries(Object.entries(PATH).map(([n, id]) => [id, n])),
    47: 'blank',
  }
  const labels: Record<number, string> = {}
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < totalColumns; col++) {
      const variant = row * 8 + (col % 8)
      const name = byVariant[variant]
      if (name) labels[row * totalColumns + col] = `f${Math.floor(col / 8) + 1}·${name}`
    }
  }
  return labels
}

function t3water(file: string): TilesetDef {
  return { name: file.replace('_pipo.png', ''), image: `${T3}${file}`, tilecount: 384, columns: 64 }
}
function t3fall(file: string): TilesetDef {
  return { name: file.replace('_pipo.png', ''), image: `${T3}${file}`, tilecount: 192, columns: 32 }
}

const WATER_LABELS    = animatedPathLabels(64)
const WATERFALL_LABELS = animatedPathLabels(32)

export const T3_Water1: Story          = { name: 'Type3 / Water1',          args: { tileset: t3water('[A]Water1_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water2: Story          = { name: 'Type3 / Water2',          args: { tileset: t3water('[A]Water2_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water3: Story          = { name: 'Type3 / Water3',          args: { tileset: t3water('[A]Water3_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water3_Cave1: Story    = { name: 'Type3 / Water3-Cave1',    args: { tileset: t3water('[A]Water3_Cave1_pipo.png'),    labels: WATER_LABELS } }
export const T3_Water4: Story          = { name: 'Type3 / Water4',          args: { tileset: t3water('[A]Water4_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water5: Story          = { name: 'Type3 / Water5',          args: { tileset: t3water('[A]Water5_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water6: Story          = { name: 'Type3 / Water6',          args: { tileset: t3water('[A]Water6_pipo.png'),          labels: WATER_LABELS } }
export const T3_Water7: Story          = { name: 'Type3 / Water7',          args: { tileset: t3water('[A]Water7_pipo.png'),          labels: WATER_LABELS } }
export const T3_WaterFall1: Story      = { name: 'Type3 / WaterFall1',      args: { tileset: t3fall('[A]WaterFall1_pipo.png'),      labels: WATERFALL_LABELS } }
export const T3_WaterFall2: Story      = { name: 'Type3 / WaterFall2',      args: { tileset: t3fall('[A]WaterFall2_pipo.png'),      labels: WATERFALL_LABELS } }
export const T3_WaterFall3: Story      = { name: 'Type3 / WaterFall3',      args: { tileset: t3fall('[A]WaterFall3_pipo.png'),      labels: WATERFALL_LABELS } }

// ── NodeMap 32×32 (world-scale tiles) ────────────────────────────────────────
// Same 8-col × 47-tile TYPE3 format for environment tiles; PATH_LABELS applies.
// Decor sheet tile IDs are shown numerically — user will define named constants.

const NM = '/nodemap/32x32/'

function nmEnv(file: string): TilesetDef {
  return { name: file.replace('.png', ''), image: `${NM}environment/${file}`, tilecount: 48, columns: 8 }
}

function nmScene(file: string): TilesetDef {
  return { name: file.replace('.png', ''), image: `${NM}scenery/${file}`, tilecount: 48, columns: 8 }
}

export const NM_Forest1:       Story = { name: 'NodeMap / forest1',       args: { tileset: nmScene('forest1.png'),       labels: SCENERY_LABELS } }
export const NM_Grass1_Dirt1:  Story = { name: 'NodeMap / grass1_dirt1',  args: { tileset: nmEnv('grass1_dirt1.png'),  labels: PATH_LABELS } }
export const NM_Grass1_Dirt2:  Story = { name: 'NodeMap / grass1_dirt2',  args: { tileset: nmEnv('grass1_dirt2.png'),  labels: PATH_LABELS } }
export const NM_Grass1_Grass2: Story = { name: 'NodeMap / grass1_grass2', args: { tileset: nmEnv('grass1_grass2.png'), labels: PATH_LABELS } }
export const NM_Grass1_Water1: Story = { name: 'NodeMap / grass1_water1', args: { tileset: nmEnv('grass1_water1.png'), labels: PATH_LABELS } }
export const NM_Gravel1:       Story = { name: 'NodeMap / gravel1',       args: { tileset: nmEnv('gravel1.png'),       labels: PATH_LABELS } }
export const NM_Hills1:        Story = { name: 'NodeMap / hills1',        args: { tileset: nmScene('hills1.png'),        labels: SCENERY_LABELS } }
export const NM_Mountains1:    Story = { name: 'NodeMap / mountains1',    args: { tileset: nmScene('mountains1.png'),    labels: SCENERY_LABELS } }
export const NM_Rocks1:        Story = { name: 'NodeMap / rocks1',        args: { tileset: nmScene('rocks1.png'),        labels: SCENERY_LABELS } }

// Decor sheet: bridges, trees, castles, mountains, volcanoes.
// tilecount is an estimate — adjust once image dimensions are confirmed.
export const NM_Decor: Story = {
  name: 'NodeMap / decor',
  args: {
    tileset: { name: 'decor', image: `${NM}decor.png`, tilecount: 64, columns: 8 },
  },
}

// ── World tilesets (additional community / hand-picked sheets) ────────────────

// pictsquare2021.png: 1952×1600px → 61 cols × 50 rows = 3050 tiles.
// Browse here to find tiles, name them, then export and add to baseChipIndex.ts
// with global IDs 11000+ and matching entries in EXTENDED_TILE_REFS.
export const Pictsquare2021: Story = {
  name: 'World / pictsquare2021',
  args: {
    tileset: {
      name: 'pictsquare2021',
      image: '/world/pictsquare2021.png',
      tilecount: 3050,
      columns: 61,
    },
  },
}
