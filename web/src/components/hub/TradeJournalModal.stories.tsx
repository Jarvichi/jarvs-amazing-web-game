import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TradeJournalModal } from './TradeJournalModal'

function seedJournal(sellers: unknown[], buyers: unknown[]): void {
  localStorage.setItem('jarv_hub_trade_journal', JSON.stringify({ sellers, buyers }))
}

const meta = {
  component: TradeJournalModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TradeJournalModal>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { onClose: fn() },
  decorators: [
    (Story) => { seedJournal([], []); return <Story /> },
  ],
}

export const WithDiscoveries: Story = {
  args: { onClose: fn() },
  decorators: [
    (Story) => {
      seedJournal(
        [
          { itemId: 'chicken-feed', town: 'Millhaven', speaker: 'Baker Pernel', price: 5, currency: 'crystals' },
          { itemId: 'net', town: 'Saltmere Port', speaker: 'Net-Maker Quill', price: 60, currency: 'crystals' },
          { itemId: 'gilded-compass', town: 'Ravenwatch', speaker: 'Guild Master Ferryn', price: 120, currency: 'crystals' },
        ],
        [
          { itemId: 'egg', town: 'Capital City', speaker: 'Baker Otto', rewardSummary: '+20 💎' },
          { itemId: 'firefly', town: 'Gravemoor', speaker: 'Little Pip', rewardSummary: '+30 💎  ·  +5 friendship' },
        ],
      )
      return <Story />
    },
  ],
}
