import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FarmingSim } from './FarmingSim'
import type { CityState } from '../../game/cityBuilder'
import { CITY_COLS, CITY_ROWS } from '../../game/cityBuilder'

// Minimal CityState for story rendering
const mockCity: CityState = {
  grid: Array(CITY_COLS * CITY_ROWS).fill(undefined),
  gold: 5000,
  resources: { wheat: 50, wood: 30, ore: 10, bread: 0, planks: 0, metal: 0 },
  lastTick: Date.now(),
  happiness: {},
  rows: CITY_ROWS,
  cols: CITY_COLS,
  nextAttackAt: Date.now() + 4 * 3600 * 1000,
  fortifications: [],
  builderQueue: [],
  builderCount: 2,
  lastAttack: null,
  chronicle: [],
  completedMilestones: [],
  attacksProcessed: 0,
  tradeOffer: null,
  activeCaravan: null,
  history: [],
  zones: [],
  activeDisaster: null,
  nextDisasterAt: Date.now() + 24 * 3600 * 1000,
  roadWear: { h: [], v: [] },
  carriers: [],
}

const meta: Meta<typeof FarmingSim> = {
  title: 'Farming/FarmingSim',
  component: FarmingSim,
}
export default meta
type Story = StoryObj<typeof FarmingSim>

export const Default: Story = {
  args: {
    city: mockCity,
    onSaveCity: (next) => console.log('save city', next.resources),
    onBack: () => console.log('back'),
  },
}
