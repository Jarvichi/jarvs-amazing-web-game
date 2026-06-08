import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TreasureModal } from './TreasureModal'
import { HubTreasure } from '../../data/hub/loader'


const meta = {
  component: TreasureModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TreasureModal>

export default meta
type Story = StoryObj<typeof meta>

const base: Omit<HubTreasure, 'reward'> = {
  id: 'chest-1',
  tx: 5,
  ty: 5,
  tileId: 888,
  title: 'Forgotten Chest',
}

export const CrystalReward: Story = {
  args: {
    treasure: { ...base, reward: { crystals: 250 } },
    onClose: fn(),
  },
}

export const CollectibleReward: Story = {
  args: {
    treasure: {
      ...base,
      title: 'Ancient Relic',
      reward: {
        collectible: { id: 'ancient-crown', name: 'Ancient Crown', icon: '👑', desc: 'A crown worn by forgotten kings.' },
      },
    },
    onClose: fn(),
  },
}

export const MixedReward: Story = {
  args: {
    treasure: {
      ...base,
      title: 'Merchant\'s Stash',
      reward: {
        crystals: 100,
        consumables: [{ id: 'health_potion', quantity: 2 }],
      },
    },
    onClose: fn(),
  },
}

export const EmptyTreasure: Story = {
  args: {
    treasure: { ...base, title: 'Empty Box', reward: {} },
    onClose: fn(),
  },
}
