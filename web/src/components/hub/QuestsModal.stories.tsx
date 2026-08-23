import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestsContent } from './QuestsModal'
import { LOCATION_REGISTRY, RAVENWATCH } from '../../data/hub/hubTownStoryFixtures'
import type { HubQuestDef } from '../../data/hub/questDefs'

/** Seeds the localStorage-backed quest store so each story shows a real state. */
function seedQuests(states: Record<string, { status: string; progress?: Record<string, number> }>): void {
  const store: Record<string, unknown> = {}
  for (const [id, s] of Object.entries(states)) {
    store[id] = { status: s.status, progress: s.progress ?? {} }
  }
  localStorage.setItem('jarv_hub_quests', JSON.stringify(store))
}

const RAVENWATCH_NPCS = new Set(RAVENWATCH.HUB_NPCS.map(n => n.id))

const quests: HubQuestDef[] = [
  {
    id: 'q-here-ready',
    type: 'fetch',
    title: "The Merchant's Ingredient",
    giverNpcId: 'merchant',
    receiverNpcId: 'merchant',
    offerDialogue: 'I need moonleaf, and plenty of it.',
    activeDialogue: { herb: 'Moonleaf grows near the north wall.' },
    completeDialogue: 'Perfect.',
    reward: { crystals: 60 },
    steps: [{ key: 'herb', type: 'collect', required: 3, itemName: 'Moonleaf Herb', itemIcon: '🌿' }],
  },
  {
    id: 'q-here-progress',
    type: 'fetch',
    title: 'Bait for Greyfish',
    giverNpcId: 'fisherman',
    receiverNpcId: 'fisherman',
    offerDialogue: 'Fetch me bait and I will show you the deep spots.',
    activeDialogue: { catch: 'Four greyfish should do it.' },
    completeDialogue: 'That will do nicely.',
    reward: { crystals: 40 },
    steps: [{ key: 'catch', type: 'collect', required: 4, itemName: 'Greyfish', itemIcon: '🐟' }],
  },
  {
    // The case the old menu could not show at all: accepted in Ravenwatch,
    // handed in at Saltmere Port.
    id: 'q-away-ready',
    type: 'chain',
    title: "The Scholar's Anthology",
    giverNpcId: 'scholar',
    receiverNpcId: 'harbourmaster-vane',
    offerDialogue: 'Carry this volume to the harbourmaster.',
    activeDialogue: { deliver: 'Vane keeps an office above the quay.' },
    completeDialogue: 'Much obliged.',
    reward: { crystals: 90 },
    steps: [{ key: 'deliver', type: 'deliver', required: 1, targetNpcId: 'harbourmaster-vane' }],
  },
]

function Story({ questDefs }: { questDefs: HubQuestDef[] }) {
  return (
    <div className="game-container">
      <div className="satchel-sheet">
        <div className="satchel-sheet__body">
          <QuestsContent
            onAbandon={fn()}
            questDefs={questDefs}
            registry={LOCATION_REGISTRY}
            currentTownName={RAVENWATCH.HUB_TOWN_NAME}
            presentNpcIds={RAVENWATCH_NPCS}
            onShowOnMap={fn()}
          />
        </div>
      </div>
    </div>
  )
}

const meta = {
  component: Story,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Story>

export default meta
type Story_ = StoryObj<typeof meta>

export const NoActiveQuests: Story_ = {
  args: { questDefs: quests },
  decorators: [(S) => { seedQuests({}); return <S /> }],
}

/** Ready-to-hand-in sorts above in-progress and is the only thing in gold. */
export const Mixed: Story_ = {
  args: { questDefs: quests },
  decorators: [(S) => {
    seedQuests({
      'q-here-ready':    { status: 'active', progress: { herb: 3 } },
      'q-here-progress': { status: 'active', progress: { catch: 2 } },
    })
    return <S />
  }],
}

/** A quest carried out of the town that gave it — invisible in the old menu,
 *  which only ever listed the current town's quests. */
export const ReadyInAnotherTown: Story_ = {
  args: { questDefs: quests },
  decorators: [(S) => {
    seedQuests({
      'q-away-ready':    { status: 'active', progress: { deliver: 0 } },
      'q-here-progress': { status: 'active', progress: { catch: 2 } },
    })
    return <S />
  }],
}

/** The screenshot's state: a long archive, now behind a filter chip. */
export const ManyCompleted: Story_ = {
  args: { questDefs: quests },
  decorators: [(S) => {
    seedQuests({
      'q-here-progress': { status: 'active', progress: { catch: 2 } },
      'q-here-ready':    { status: 'completed' },
      'q-away-ready':    { status: 'completed' },
    })
    return <S />
  }],
}
