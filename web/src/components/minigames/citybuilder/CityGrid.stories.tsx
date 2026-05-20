import React, { useRef } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityGrid } from './CityGrid'

const meta = {
  component: CityGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CityGrid>

export default meta
type Story = StoryObj<typeof meta>

const emptyCity: any = {
  grid: new Array(16).fill(undefined),
  rows: 4,
  happiness: {},
  resources: { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
  fortifications: [],
  builderQueue: [],
  gold: 0,
  nextAttackAt: Date.now() + 8 * 60 * 60 * 1000,
}

const populatedCity: any = {
  ...emptyCity,
  grid: [
    { cardName: 'Farm', rarity: 'common' },
    { cardName: 'Dragon Lair', rarity: 'rare', spawnedUnitName: 'Dragon' },
    { cardName: 'Sawmill', rarity: 'common' },
    undefined,
    ...new Array(12).fill(undefined),
  ],
  happiness: { 1: 90 },
}

function WithRef(props: Omit<React.ComponentProps<typeof CityGrid>, 'worldRef'>) {
  const ref = useRef<HTMLDivElement>(null)
  return <CityGrid {...props} worldRef={ref} />
}

export const EmptyCity: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={emptyCity}
      walkers={[]}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={false}
      paintBrush={false} onCellTap={fn()} onPaint={fn()}
      onWalkerClick={fn()}
    />
  ),
}

export const PopulatedCity: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={populatedCity}
      walkers={[]}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={false}
      paintBrush={false} onCellTap={fn()} onPaint={fn()}
      onWalkerClick={fn()}
    />
  ),
}

export const BulldozerMode: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={populatedCity}
      walkers={[]}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={true}
      paintBrush={false} onCellTap={fn()} onPaint={fn()}
      onWalkerClick={fn()}
    />
  ),
}

// ── Road wear debug stories ────────────────────────────────────────────────────
// CITY_COLS=6, CITY_ROWS=4 → 24 cells, indices 0-23.
// h[i] = wear from left→right travel between cell i and i+1 (5 gaps per row).
// v[i] = wear from top→bottom travel between cell i and i+COLS (per column).
//
// HorizontalRoadWear: h[0..4] = 100 → horizontal stripe on TOP of cells 1-5 in row 0.
// VerticalRoadWear:   v[0,6,12] = 100 → vertical stripe on LEFT of cells 6,12,18 in col 0.

const COLS = 6

const makeGrid = (occupied: number[]) =>
  Array.from({ length: 24 }, (_, i) =>
    occupied.includes(i) ? { cardName: 'Farm', rarity: 'common', stock: {} } : undefined
  )

const horizontalWearCity: any = {
  ...emptyCity,
  grid: makeGrid([0, 1, 2, 3, 4, 5]),   // row 0 all occupied
  roadWear: {
    h: Array.from({ length: 24 }, (_, i) => (i < COLS - 1 ? 100 : 0)),  // h[0..4] = 100
    v: new Array(24).fill(0),
  },
}

const verticalWearCity: any = {
  ...emptyCity,
  grid: makeGrid([0, COLS, COLS * 2, COLS * 3]),  // column 0 all occupied
  roadWear: {
    h: new Array(24).fill(0),
    v: Array.from({ length: 24 }, (_, i) => (i % COLS === 0 && i < COLS * 3 ? 100 : 0)),  // v[0,6,12] = 100
  },
}

export const HorizontalRoadWear: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={horizontalWearCity}
      walkers={[]}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={false}
      paintBrush={false} onCellTap={fn()} onPaint={fn()}
      onWalkerClick={fn()}
    />
  ),
}

export const VerticalRoadWear: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={verticalWearCity}
      walkers={[]}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={false}
      paintBrush={false} onCellTap={fn()} onPaint={fn()}
      onWalkerClick={fn()}
    />
  ),
}
