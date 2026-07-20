import { fn, within, userEvent } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomeShelf } from './HomeShelf'
import type { ItemEntry } from '../../game/itemStore'
import { saveCrystals } from '../../game/collection'

// Seed the localStorage-backed item store the shelf reads (relics + items).
function seedItemStore(items: ItemEntry[]): void {
  localStorage.setItem('jarv_item_store', JSON.stringify(items))
}

// DECORATE only renders for a real owned-house key (not the 'default' bucket)
// — see HomeShelf.tsx's houseKey !== 'default' gating — so these stories use
// a stand-in house key, matching how the in-house 🛋 DECORATE button invokes it.
const HOUSE_KEY = 'ravenwatch:building-1'

// Seed the decorate-tab stores: placed furniture, owned furniture ids, crystals.
function seedDecorate(opts: { placed?: unknown[]; owned?: string[]; crystals?: number } = {}): void {
  localStorage.setItem(`jarv_hub_home_layout:${HOUSE_KEY}`, JSON.stringify({ placed: opts.placed ?? [] }))
  localStorage.setItem('jarv_hub_furniture_owned', JSON.stringify(opts.owned ?? []))
  saveCrystals(opts.crystals ?? 100)
}

async function clickDecorateTab({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole('button', { name: 'DECORATE' }))
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

export const DecorateEmpty: Story = {
  args: { onBack: fn(), houseKey: HOUSE_KEY },
  decorators: [
    (Story) => { seedItemStore([]); seedDecorate(); return <Story /> },
  ],
  play: clickDecorateTab,
}

export const DecoratePopulated: Story = {
  args: { onBack: fn(), houseKey: HOUSE_KEY },
  decorators: [
    (Story) => {
      seedItemStore([])
      seedDecorate({
        owned: ['reading-lamp', 'cozy-rug', 'round-table'],
        placed: [
          { id: 'lamp-1', itemId: 'reading-lamp', x: 0, y: 0, rotation: 0 },
          { id: 'rug-1', itemId: 'cozy-rug', x: 2, y: 1, rotation: 0 },
        ],
        crystals: 42,
      })
      return <Story />
    },
  ],
  play: clickDecorateTab,
}
