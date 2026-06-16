import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTownUpgrades, type UpgradeRow } from './HubTownUpgrades'
import { getUpgradeTrack } from '../../data/hub/buildingUpgrades'

const shop = getUpgradeTrack('shop')
const inn = getUpgradeTrack('inn')

const rows: UpgradeRow[] = [
  // Affordable next level.
  {
    buildingId: 'card-shop', name: 'The Card Emporium', kind: 'shop', level: 1, total: shop.length,
    next: { def: shop[1], level: 1, total: shop.length, cost: shop[1].cost, repRequired: shop[1].repRequired, repLocked: false, maxed: false },
  },
  // Reputation-locked next level.
  {
    buildingId: 'inn', name: 'The Wayfarer Inn', kind: 'inn', level: 1, total: inn.length,
    next: { def: inn[1], level: 1, total: inn.length, cost: inn[1].cost, repRequired: inn[1].repRequired, repLocked: true, maxed: false },
  },
  // Fully upgraded.
  {
    buildingId: 'shrine', name: 'The Old Shrine', kind: 'shrine', level: 3, total: 3,
    next: { def: null, level: 3, total: 3, cost: 0, repRequired: 0, repLocked: false, maxed: true },
  },
]

const meta = {
  component: HubTownUpgrades,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof HubTownUpgrades>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onClose:    fn(),
    townName:   'Ravenwatch',
    reputation: 80,
    crystals:   500,
    rows,
    onUpgrade:  fn(),
  },
}

export const Broke: Story = {
  args: {
    onClose:    fn(),
    townName:   'Ravenwatch',
    reputation: 80,
    crystals:   10,
    rows,
    onUpgrade:  fn(),
  },
}
