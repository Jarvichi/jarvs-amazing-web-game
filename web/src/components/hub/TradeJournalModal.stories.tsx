import type { Meta, StoryObj } from '@storybook/react-vite'
import { TradeJournalContent } from './TradeJournalModal'

function seedJournal(sellers: unknown[], buyers: unknown[]): void {
  localStorage.setItem('jarv_hub_trade_journal', JSON.stringify({ sellers, buyers }))
}

const meta = {
  component: TradeJournalContent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <div className="satchel-sheet">
          <div className="satchel-sheet__body"><Story /></div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof TradeJournalContent>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    (Story) => { seedJournal([], []); return <Story /> },
  ],
}

export const WithDiscoveries: Story = {
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
