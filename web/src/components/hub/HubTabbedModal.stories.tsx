import { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTabbedModal, type HubTabId } from './HubTabbedModal'
import { RAVENWATCH } from '../../data/hub/hubTownStoryFixtures'
import { getUpgradeTrack } from '../../data/hub/buildingUpgrades'
import type { UpgradeRow } from './HubTownUpgrades'

const shop = getUpgradeTrack('shop')
const upgradeRows: UpgradeRow[] = [
  {
    buildingId: 'card-shop', name: 'The Card Emporium', kind: 'shop', level: 1, total: shop.length,
    next: { def: shop[1], level: 1, total: shop.length, cost: shop[1].cost, repRequired: shop[1].repRequired, repLocked: false, maxed: false },
  },
]

function Interactive({ initialTab, hasPet }: { initialTab: HubTabId; hasPet: boolean }) {
  const [activeTab, setActiveTab] = useState<HubTabId>(initialTab)
  return (
    <HubTabbedModal
      onClose={fn()}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      hasPet={hasPet}
      onAbandon={fn()}
      questDefs={[]}
      allQuestDefs={[]}
      locationData={RAVENWATCH}
      pinnedNpcId={null}
      onTogglePin={fn()}
      onShowRelationship={fn()}
      townName="Ravenwatch"
      reputation={80}
      crystals={500}
      rows={upgradeRows}
      onUpgrade={fn()}
      tributeAmount={34}
      tributeAvailable={true}
      onCollectTribute={fn()}
    />
  )
}

const meta = {
  component: Interactive,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { initialTab: 'quests', hasPet: false },
}

export const UpgradesTabWithPet: Story = {
  args: { initialTab: 'upgrades', hasPet: true },
}
