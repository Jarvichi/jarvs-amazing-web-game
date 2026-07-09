import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomeShelf } from './HomeShelf'
import type { ItemEntry } from '../../game/itemStore'

// Seed the localStorage-backed item store the shelf reads (relics + items).
function seedItemStore(items: ItemEntry[]): void {
  localStorage.setItem('jarv_item_store', JSON.stringify(items))
}

const meta = {
  component: HomeShelf,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HomeShelf>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { onBack: fn() },
  decorators: [
    (Story) => { seedItemStore([]); return <Story /> },
  ],
}

export const RelicsOnly: Story = {
  args: { onBack: fn() },
  decorators: [
    (Story) => {
      seedItemStore([
        { id: 'Bark Shield', type: 'relic', count: 1 },
        { id: 'Iron Standard', type: 'relic', count: 1 },
      ])
      return <Story />
    },
  ],
}

export const Populated: Story = {
  args: { onBack: fn() },
  decorators: [
    (Story) => {
      seedItemStore([
        { id: 'Bark Shield', type: 'relic', count: 1 },
        // Stale entry stored before the questDefs.json icon fix, with the old
        // broken icon string baked in and no isKeepsake flag (granted before
        // that flag existed either) — resolved against the current known-
        // collectible catalog by loadInventory(), not the stale stored fields.
        {
          id: 'hearthstone', type: 'item', count: 1, acquiredDate: '2026-01-01',
          name: 'The Hearthstone', icon: 'goldChest',
          desc: 'The reunified Hearthstone — three fragments made whole.',
        },
        {
          id: 'ravenwatch-church-key', type: 'item', count: 1, acquiredDate: '2026-01-02',
          name: 'Church Key', icon: '🗝️', desc: 'A key to the Ravenwatch church.',
          isKeepsake: true,
        },
        // Legacy narrative reward acquired before the isKeepsake flag existed —
        // should still land in Keepsakes via the shape-based fallback.
        {
          id: 'ravenwatch-legacy-note', type: 'item', count: 1, acquiredDate: '2025-12-01',
          name: 'Weathered Note', icon: '📜', desc: 'A scrap of paper found tucked in an alley.',
        },
        {
          id: 'slippers', type: 'item', count: 1, acquiredDate: '2026-01-03',
          name: 'Virtual Slippers', icon: '🥿', desc: 'Cozy, but digital. Left one only.',
        },
        {
          id: 'lint', type: 'item', count: 1, acquiredDate: '2026-01-04',
          name: 'Pocket Lint', icon: '🧶', desc: 'Found in your other pants.',
        },
      ])
      return <Story />
    },
  ],
}
