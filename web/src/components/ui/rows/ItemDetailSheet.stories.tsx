import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemDetailSheet } from './ItemDetailSheet'

const meta = {
  component: ItemDetailSheet,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof ItemDetailSheet>

export default meta
type Story = StoryObj<typeof meta>

/** A quest item explains what is waiting on it. */
export const QuestItem: Story = {
  args: {
    onClose: fn(),
    detail: {
      item: {
        id: 'quest:q-grain:grain', name: 'Grain Sack', icon: '🌾', category: 'quest', count: 2,
        need: { questId: 'q-grain', questTitle: 'The Missing Grain', required: 3 },
      },
      sellers: [],
      buyers: [],
    },
  },
}

export const QuestItemSatisfied: Story = {
  args: {
    onClose: fn(),
    detail: {
      item: {
        id: 'quest:q-grain:grain', name: 'Grain Sack', icon: '🌾', category: 'quest', count: 3,
        need: { questId: 'q-grain', questTitle: 'The Missing Grain', required: 3 },
      },
      sellers: [],
      buyers: [],
    },
  },
}

/** Trade-journal knowledge, delivered where the question gets asked. */
export const TradedMaterial: Story = {
  args: {
    onClose: fn(),
    detail: {
      item: { id: 'feather', name: 'Feather', icon: '🪶', category: 'material', count: 7 },
      sellers: [{ itemId: 'feather', town: 'Saltmere Port', speaker: 'Fishwife Pearl', price: 12, currency: 'crystals' }],
      buyers:  [{ itemId: 'feather', town: 'Ravenwatch', speaker: 'Vex the Merchant', rewardSummary: '15 💎 each' }],
    },
  },
}

export const NothingKnownYet: Story = {
  args: {
    onClose: fn(),
    detail: {
      item: { id: 'pine-log', name: 'Pine Log', icon: '🪵', category: 'material', count: 12 },
      sellers: [],
      buyers: [],
    },
  },
}
