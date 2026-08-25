import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TodaySection } from './TodaySection'
import type { QuestView } from '../../../game/hub/questBoard'

const readyHere: QuestView = {
  id: 'q1', title: "The Merchant's Ingredient", kind: 'quest', ready: true,
  objectives: [{ key: 'herb', label: 'Collect Moonleaf Herb', current: 3, required: 3, done: true }],
  target: { npcId: 'merchant', name: 'Vex the Merchant', townName: 'Ravenwatch', here: true },
  reward: { crystals: 60 }, hint: '', current: 3, required: 3,
}

const readyAway: QuestView = {
  id: 'q2', title: "The Scholar's Anthology", kind: 'quest', ready: true,
  objectives: [{ key: 'deliver', label: 'Deliver to Harbourmaster Vane', current: 1, required: 1, done: true }],
  target: { npcId: 'harbourmaster-vane', name: 'Harbourmaster Vane', townName: 'Saltmere Port', here: false },
  reward: { crystals: 90 }, hint: '', current: 1, required: 1,
}

const inProgress: QuestView = {
  id: 'q3', title: 'Bait for Greyfish', kind: 'quest', ready: false,
  objectives: [{ key: 'catch', label: 'Catch Greyfish', current: 2, required: 4, done: false }],
  target: null, reward: { crystals: 40 }, hint: 'Four greyfish should do it.', current: 2, required: 4,
}

const bounty: QuestView = {
  id: 'b1', title: 'Cellar Sweep', kind: 'bounty', ready: false,
  objectives: [{ key: 'clear', label: 'Clear the crates', current: 5, required: 8, done: false }],
  target: null, reward: { crystals: 60 }, hint: 'Clear the crates', current: 5, required: 8,
}

const meta = {
  component: TodaySection,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet">
        <div className="satchel-sheet__body"><Story /></div>
      </div>
    </div>
  )],
  args: {
    townName: 'Ravenwatch',
    codexPct: 42,
    onShowOnMap: fn(),
    onOpenSection: fn(),
    onOpenPet: fn(),
    chronicleUnread: false,
    onOpenChronicle: fn(),
  },
} satisfies Meta<typeof TodaySection>

export default meta
type Story = StoryObj<typeof meta>

/** The busy case: two things finishable here, two still running, one stranded. */
export const Busy: Story = {
  args: {
    readyHere: [readyHere],
    inProgress: [inProgress, bounty],
    readyElsewhere: [readyAway],
    tribute: { amount: 120, available: true, onCollect: fn() },
    pet: { name: 'Pip', note: 'Following you · 2 treats left today' },
  },
}

/** Nothing actionable from here — the quiet state has to read as calm, not broken. */
export const NothingToDo: Story = {
  args: {
    readyHere: [], inProgress: [], readyElsewhere: [],
    tribute: { amount: 0, available: false, onCollect: fn() },
    pet: null,
  },
}

/** Everything finished is waiting in other towns — the case the old menu hid. */
export const AllWaitingElsewhere: Story = {
  args: {
    readyHere: [], inProgress: [], readyElsewhere: [readyAway],
    tribute: { amount: 0, available: false, onCollect: fn() },
    pet: { name: 'Pip', note: 'Following you · no treats left today' },
  },
}

/** A new Chronicle chapter is unread — the fallback for towns other than
 *  Ravenwatch, where the Chronicler can't chase the player down herself. */
export const ChronicleAlert: Story = {
  args: {
    readyHere: [], inProgress: [], readyElsewhere: [],
    tribute: { amount: 0, available: false, onCollect: fn() },
    pet: null,
    chronicleUnread: true,
  },
}
