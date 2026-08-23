import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubInventoryContent } from './HubInventoryModal'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { ItemEntry } from '../../game/itemStore'

// Seed the localStorage-backed stores the Satchel reads (item store, quest
// state, trade journal) so each story shows a distinct bag.
function seedStores(opts: {
  items?: ItemEntry[]
  activeQuestIds?: string[]
  sellers?: unknown[]
  buyers?: unknown[]
}): void {
  localStorage.setItem('jarv_item_store', JSON.stringify(opts.items ?? []))
  const quests: Record<string, { status: string; progress: Record<string, number> }> = {}
  for (const id of opts.activeQuestIds ?? []) quests[id] = { status: 'active', progress: {} }
  localStorage.setItem('jarv_hub_quests', JSON.stringify(quests))
  localStorage.setItem('jarv_hub_trade_journal', JSON.stringify({
    sellers: opts.sellers ?? [], buyers: opts.buyers ?? [],
  }))
}

const grainQuest: HubQuestDef = {
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
  component: HubInventoryContent,
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
} satisfies Meta<typeof HubInventoryContent>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { questDefs: [] },
  decorators: [(S) => { seedStores({}); return <S /> }],
}

/** The gold corner marks a tile a quest is waiting on. */
export const QuestItemsInProgress: Story = {
  args: { questDefs: [grainQuest] },
  decorators: [(S) => {
    seedStores({
      items: [{ id: 'quest:q-grain:grain', type: 'hub-item', count: 2, name: 'Grain Sack', icon: '🌾', category: 'quest' }],
      activeQuestIds: ['q-grain'],
    })
    return <S />
  }],
}

export const FullSatchel: Story = {
  args: { questDefs: [grainQuest] },
  decorators: [(S) => {
    seedStores({
      items: [
        { id: 'quest:q-grain:grain', type: 'hub-item', count: 3, name: 'Grain Sack', icon: '🌾', category: 'quest' },
        { id: 'fishing-rod',  type: 'hub-item', count: 1, name: 'Fishing Rod',  icon: '🎣', category: 'tool' },
        { id: 'shovel',       type: 'hub-item', count: 1, name: 'Shovel',       icon: '⛏',  category: 'tool' },
        { id: 'chicken-feed', type: 'hub-item', count: 4, name: 'Chicken Feed', icon: '🌾', category: 'material' },
        { id: 'egg',          type: 'hub-item', count: 2, name: 'Egg',          icon: '🥚', category: 'material' },
        { id: 'feather',      type: 'hub-item', count: 7, name: 'Feather',      icon: '🪶', category: 'material' },
        { id: 'pine-log',     type: 'hub-item', count: 12, name: 'Pine Log',    icon: '🪵', category: 'material' },
        { id: 'rough-stone',  type: 'hub-item', count: 8, name: 'Rough Stone',  icon: '🪨', category: 'material' },
      ],
      activeQuestIds: ['q-grain'],
      sellers: [{ itemId: 'feather', town: 'Saltmere Port', speaker: 'Fishwife Pearl', price: 12, currency: 'crystals' }],
      buyers:  [{ itemId: 'feather', town: 'Ravenwatch', speaker: 'Vex the Merchant', rewardSummary: '15 💎 each' }],
    })
    return <S />
  }],
}

/** The search field in the sheet header filters the grid. */
export const Searching: Story = {
  args: { questDefs: [grainQuest], query: 'feather' },
  decorators: [(S) => {
    seedStores({
      items: [
        { id: 'feather',  type: 'hub-item', count: 7,  name: 'Feather',  icon: '🪶', category: 'material' },
        { id: 'pine-log', type: 'hub-item', count: 12, name: 'Pine Log', icon: '🪵', category: 'material' },
      ],
    })
    return <S />
  }],
}
