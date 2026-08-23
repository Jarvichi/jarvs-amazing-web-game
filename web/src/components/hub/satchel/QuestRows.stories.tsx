import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestReadyCard, QuestProgressRow } from './QuestRows'
import type { QuestView } from '../../../game/hub/questBoard'

const base: QuestView = {
  id: 'q1', title: "The Merchant's Ingredient", kind: 'quest', ready: true,
  objectives: [{ key: 'herb', label: 'Collect Moonleaf Herb', current: 3, required: 3, done: true }],
  target: { npcId: 'merchant', name: 'Vex the Merchant', townName: 'Ravenwatch', here: true },
  reward: { crystals: 60 }, hint: '', current: 3, required: 3,
}

const meta = {
  component: QuestReadyCard,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof QuestReadyCard>

export default meta
type Story = StoryObj<typeof meta>

/** Handable from where the player is standing: gold, with its own action. */
export const ReadyHere: Story = { args: { view: base, onShowOnMap: fn() } }

/** Finished, but the receiver is elsewhere — real, but not actionable here. */
export const ReadyInAnotherTown: Story = {
  args: {
    onShowOnMap: fn(),
    view: {
      ...base,
      id: 'q2',
      title: "The Scholar's Anthology",
      target: { npcId: 'vane', name: 'Harbourmaster Vane', townName: 'Saltmere Port', here: false },
    },
  },
}

export const InProgress: Story = {
  args: { view: base, onShowOnMap: fn() },
  render: () => (
    <>
      <QuestProgressRow
        onShowOnMap={fn()}
        view={{
          ...base, id: 'q3', title: 'Bait for Greyfish', ready: false,
          objectives: [{ key: 'catch', label: 'Catch Greyfish', current: 2, required: 4, done: false }],
          target: null, current: 2, required: 4, hint: 'Four greyfish should do it.',
        }}
      />
      <QuestProgressRow
        onShowOnMap={fn()}
        view={{
          ...base, id: 'b1', title: 'Cellar Sweep', kind: 'bounty', ready: false,
          objectives: [{ key: 'clear', label: 'Clear the crates', current: 5, required: 8, done: false }],
          target: null, current: 5, required: 8, hint: 'Clear the crates',
        }}
      />
    </>
  ),
}
