import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TileBrowser, TilesetDef } from './TileBrowser'

const meta = {
  component: TileBrowser,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TileBrowser>

export default meta
type Story = StoryObj<typeof meta>

const BASE_PATH = '/world/SampleMap/'

const TILESETS: Record<string, TilesetDef> = {
  BaseChip:    { name: '[Base]BaseChip_pipo', image: `${BASE_PATH}[Base]BaseChip_pipo.png`,  tilecount: 1064, columns: 8  },
  Grass:       { name: '[A]Grass_pipo',       image: `${BASE_PATH}[A]Grass_pipo.png`,        tilecount: 528,  columns: 8  },
  Dirt:        { name: '[A]Dirt_pipo',        image: `${BASE_PATH}[A]Dirt_pipo.png`,         tilecount: 336,  columns: 8  },
  Flower:      { name: '[A]Flower_pipo',      image: `${BASE_PATH}[A]Flower_pipo.png`,       tilecount: 48,   columns: 8  },
  WallUp:      { name: '[A]Wall-Up_pipo',     image: `${BASE_PATH}[A]Wall-Up_pipo.png`,      tilecount: 96,   columns: 8  },
  Water:       { name: '[A]Water_pipo',       image: `${BASE_PATH}[A]Water_pipo.png`,        tilecount: 3072, columns: 64 },
  WaterFall:   { name: '[A]WaterFall_pipo',   image: `${BASE_PATH}[A]WaterFall_pipo.png`,    tilecount: 576,  columns: 32 },
  LightShadow: { name: 'LightShadow_pipo',    image: `${BASE_PATH}LightShadow_pipo.png`,     tilecount: 48,   columns: 8  },
}

export const BaseChip: Story    = { args: { tileset: TILESETS.BaseChip } }
export const Grass: Story       = { args: { tileset: TILESETS.Grass } }
export const Dirt: Story        = { args: { tileset: TILESETS.Dirt } }
export const Flower: Story      = { args: { tileset: TILESETS.Flower } }
export const WallUp: Story      = { args: { tileset: TILESETS.WallUp } }
export const Water: Story       = { args: { tileset: TILESETS.Water } }
export const WaterFall: Story   = { args: { tileset: TILESETS.WaterFall } }
export const LightShadow: Story = { args: { tileset: TILESETS.LightShadow } }
