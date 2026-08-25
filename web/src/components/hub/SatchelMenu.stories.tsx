import { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SatchelMenu, type SatchelSectionId, type TownView } from './SatchelMenu'
import { RAVENWATCH, RAVENWATCH_QUESTS, LOCATION_REGISTRY } from '../../data/hub/hubTownStoryFixtures'
import { getUpgradeTrack } from '../../data/hub/buildingUpgrades'
import type { UpgradeRow } from './HubTownUpgrades'

const shop = getUpgradeTrack('shop')
const upgradeRows: UpgradeRow[] = [
  {
    buildingId: 'card-shop', name: 'The Card Emporium', kind: 'shop', level: 1, total: shop.length,
    next: { def: shop[1], level: 1, total: shop.length, cost: shop[1].cost, repRequired: shop[1].repRequired, repLocked: false, maxed: false },
  },
]

function Interactive({ initialSection, initialTownView = 'people' }: { initialSection: SatchelSectionId; initialTownView?: TownView }) {
  const [activeSection, setActiveSection] = useState<SatchelSectionId>(initialSection)
  const [townView, setTownView] = useState<TownView>(initialTownView)
  return (
    <SatchelMenu
      onClose={fn()}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      townView={townView}
      onTownViewChange={setTownView}
      onAbandon={fn()}
      allQuestDefs={RAVENWATCH_QUESTS.HUB_QUEST_DEFS}
      registry={LOCATION_REGISTRY}
      onShowOnMap={fn()}
      onOpenPet={fn()}
      chronicleUnread={false}
      onOpenChronicle={fn()}
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

export const Today:   Story = { args: { initialSection: 'today' } }
export const Quests:  Story = { args: { initialSection: 'quests' } }
export const Satchel: Story = { args: { initialSection: 'satchel' } }

/** Where is…? and Standing & Upgrades are chips inside one section now. */
export const Town: Story = { args: { initialSection: 'town' } }

/** The town hall's upgrades interactable deep-links straight to Standing. */
export const TownStanding: Story = { args: { initialSection: 'town', initialTownView: 'standing' } }

/** The journal's four categories plus the trade journal, as one chip row. */
export const Codex: Story = { args: { initialSection: 'codex' } }

export const Phone: Story = {
  args: { initialSection: 'today' },
  globals: { viewport: { value: 'mobile1' } },
}
