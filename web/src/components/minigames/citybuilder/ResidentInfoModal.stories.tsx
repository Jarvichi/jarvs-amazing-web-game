import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResidentInfoModal } from './ResidentInfoModal'

const meta = {
  component: ResidentInfoModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ResidentInfoModal>

export default meta
type Story = StoryObj<typeof meta>

const baseCity: any = {
  grid: [],
  rows: 4,
  happiness: { 2: 100 },
  resources: { wheat: 100, wood: 50, ore: 10, bread: 0, planks: 0, metal: 0 },
  fortifications: [{ cardName: 'Stone Wall', rarity: 'common', hp: 100, maxHp: 100, attacksTaken: 0 }],
  builderQueue: [],
  gold: 500,
}

const happyCell: any = {
  cardName: 'Dragon Lair',
  rarity: 'rare',
  spawnedUnitName: 'Dragon',
}

const walker = {
  cellIndex: 2, unitIndex: 0, unitName: 'Dragon',
  x: 100, y: 80, vx: 0.5, vy: 0.3,
  turnTimer: 10,
  task: { type: 'patrolling' as const, label: '🛡 Patrolling the walls' },
  taskTimer: 20, bubbleTimer: 5, hidden: false, hiddenTimer: 0, trait: 'industrious' as const,
  waypoints: [],
}

export const HappyResident: Story = {
  args: {} as any,
  render: () => (
    <ResidentInfoModal
      cellIndex={2}
      unitIndex={0}
      cell={happyCell}
      city={{ ...baseCity, happiness: { 2: 100 } }}
      walkers={[walker]}
      onClose={fn()}
    />
  ),
}

export const UnhappyResident: Story = {
  args: {} as any,
  render: () => (
    <ResidentInfoModal
      cellIndex={2}
      unitIndex={0}
      cell={{ ...happyCell, affinityWith: 'Knight' }}
      city={{ ...baseCity, happiness: { 2: 25 }, resources: { ...baseCity.resources, wheat: 1 } }}
      walkers={[{ ...walker, task: { type: 'resting' as const, label: '🏠 Taking shelter!' } }]}
      onClose={fn()}
    />
  ),
}

export const ResidentGone: Story = {
  args: {} as any,
  render: () => (
    <ResidentInfoModal
      cellIndex={2}
      unitIndex={0}
      cell={happyCell}
      city={{ ...baseCity, happiness: { 2: 0 } }}
      walkers={[]}
      onClose={fn()}
    />
  ),
}
