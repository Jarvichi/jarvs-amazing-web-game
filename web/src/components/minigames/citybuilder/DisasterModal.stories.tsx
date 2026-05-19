import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DisasterModal } from './DisasterModal'

const meta = {
  component: DisasterModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DisasterModal>

export default meta
type Story = StoryObj<typeof meta>

const baseCity: any = {
  grid: new Array(16).fill(undefined),
  rows: 4,
  happiness: {},
  resources: { wheat: 50, wood: 200, ore: 0, bread: 30, planks: 0, metal: 0 },
  fortifications: [],
  builderQueue: [],
  gold: 500,
  districts: {},
}

export const FireAffordable: Story = {
  args: {
    city: baseCity,
    disaster: {
      type: 'fire',
      affectedCells: [2, 3],
      startedAt: Date.now() - 5 * 60 * 1000,
      severity: 20,
    },
    onExtinguish: fn(),
    onCure: fn(),
    onClose: fn(),
  },
}

export const FireUnaffordable: Story = {
  args: {
    city: { ...baseCity, resources: { ...baseCity.resources, wood: 5 } },
    disaster: {
      type: 'fire',
      affectedCells: [5],
      startedAt: Date.now() - 2 * 60 * 1000,
      severity: 10,
    },
    onExtinguish: fn(),
    onCure: fn(),
    onClose: fn(),
  },
}

export const Plague: Story = {
  args: {
    city: baseCity,
    disaster: {
      type: 'plague',
      affectedCells: [],
      startedAt: Date.now() - 30 * 60 * 1000,
      severity: 65,
    },
    onExtinguish: fn(),
    onCure: fn(),
    onClose: fn(),
  },
}
