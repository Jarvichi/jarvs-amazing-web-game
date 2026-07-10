import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FurniturePicker } from './FurniturePicker'
import type { FurnitureDef } from '../../../game/hub/furniture'

const DEFS: FurnitureDef[] = [
  { id: 'reading-lamp', name: 'Reading Lamp', icon: '💡', desc: 'Warm light.', footprint: { w: 1, h: 1 }, price: 20 },
  { id: 'cozy-rug', name: 'Cozy Rug', icon: '🟥', desc: 'A thick rug.', footprint: { w: 2, h: 2 }, price: 30 },
  { id: 'oak-bookshelf', name: 'Oak Bookshelf', icon: '📚', desc: 'A library.', footprint: { w: 1, h: 2 }, price: 45 },
  { id: 'round-table', name: 'Round Table', icon: '🟤', desc: 'A table.', footprint: { w: 2, h: 1 }, price: 35 },
]

const meta = {
  component: FurniturePicker,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FurniturePicker>

export default meta
type Story = StoryObj<typeof meta>

export const AllLocked: Story = {
  args: { defs: DEFS, ownedIds: [], armedId: null, onPick: fn() },
}

export const MixedOwnership: Story = {
  args: { defs: DEFS, ownedIds: ['reading-lamp', 'round-table'], armedId: null, onPick: fn() },
}

export const ItemArmed: Story = {
  args: { defs: DEFS, ownedIds: ['reading-lamp', 'round-table'], armedId: 'reading-lamp', onPick: fn() },
}
