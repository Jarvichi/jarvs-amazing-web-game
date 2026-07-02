import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubInventoryModal } from './HubInventoryModal'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { ItemEntry } from '../../game/itemStore'

// Seed the localStorage-backed stores the modal reads (item store, quest
// state, pet accessories) so each story shows a distinct inventory state.
function seedStores(opts: {
  items?: ItemEntry[]
  activeQuestIds?: string[]
  questProgress?: Record<string, Record<string, number>>
  ownedAccessories?: string[]
}): void {
  localStorage.setItem('jarv_item_store', JSON.stringify(opts.items ?? []))
  const quests: Record<string, { status: string; progress: Record<string, number> }> = {}
  for (const id of opts.activeQuestIds ?? []) {
    quests[id] = { status: 'active', progress: opts.questProgress?.[id] ?? {} }
  }
  localStorage.setItem('jarv_hub_quests', JSON.stringify(quests))
  const pet = opts.ownedAccessories
    ? { pet: null, accessories: { owned: opts.ownedAccessories, equipped: {} } }
    : {}
  localStorage.setItem('jarv_hub_pet', JSON.stringify(pet))
}

const sampleQuest: HubQuestDef = {
  id: 'q-grain',
  type: 'fetch',
  title: 'The Missing Grain',
  giverNpcId: 'mill-owner',
  receiverNpcId: 'mill-owner',
  offerDialogue: 'Three sacks of grain, scattered by thieves.',
  activeDialogue: 'Find my grain sacks!',
  completeDialogue: 'Wonderful!',
  reward: { crystals: 50 },
  steps: [
    { key: 'grain', type: 'collect', required: 3, pickupIds: ['g1', 'g2', 'g3'], itemName: 'Grain Sack', itemIcon: '🌾' },
  ],
}

const meta = {
  component: HubInventoryModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubInventoryModal>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { onClose: fn(), questDefs: [] },
  decorators: [
    (Story) => { seedStores({}); return <Story /> },
  ],
}

export const QuestItemsInProgress: Story = {
  args: { onClose: fn(), questDefs: [sampleQuest] },
  decorators: [
    (Story) => {
      seedStores({
        items: [
          { id: 'quest:q-grain:grain', type: 'hub-item', count: 2, name: 'Grain Sack', icon: '🌾', category: 'quest' },
        ],
        activeQuestIds: ['q-grain'],
        questProgress: { 'q-grain': { grain: 2 } },
      })
      return <Story />
    },
  ],
}

export const FullInventory: Story = {
  args: { onClose: fn(), questDefs: [sampleQuest] },
  decorators: [
    (Story) => {
      seedStores({
        items: [
          { id: 'quest:q-grain:grain', type: 'hub-item', count: 1, name: 'Grain Sack', icon: '🌾', category: 'quest' },
          { id: 'fishing-rod', type: 'hub-item', count: 1, name: 'Fishing Rod', icon: '🎣', category: 'tool' },
          { id: 'chicken-feed', type: 'hub-item', count: 4, name: 'Chicken Feed', icon: '🌾', category: 'material' },
          { id: 'egg', type: 'hub-item', count: 2, name: 'Egg', icon: '🥚', category: 'material' },
          { id: 'feather', type: 'hub-item', count: 1, name: 'Feather', icon: '🪶', category: 'material' },
          { id: 'fish-medium', type: 'hub-item', count: 1, name: 'Medium Fish', icon: '🐡', category: 'material' },
        ],
        activeQuestIds: ['q-grain'],
        questProgress: { 'q-grain': { grain: 1 } },
        ownedAccessories: ['top-hat', 'red-bow'],
      })
      return <Story />
    },
  ],
}
