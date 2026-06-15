import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BountyBoardModal } from './BountyBoardModal'
import type { BountyDef } from '../../game/hub/bounties'

const meta = {
  component: BountyBoardModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BountyBoardModal>

export default meta
type Story = StoryObj<typeof meta>

const sampleBounties: BountyDef[] = [
  {
    id: 'bounty-collect-herbs',
    title: 'Herb Gathering',
    steps: [
      { key: 'herbs', type: 'collect', description: 'Collect herbs from the fields', required: 5 },
    ],
    reward: { crystals: 30 },
  },
  {
    id: 'bounty-talk-guard',
    title: 'Guard Reports',
    steps: [
      { key: 'talk', type: 'talk', description: 'Speak with the gate guard', required: 1, targetNpcId: 'guard-npc' },
    ],
    reward: { crystals: 20 },
  },
  {
    id: 'bounty-win-battle',
    title: 'Bandit Cleanup',
    steps: [
      { key: 'win', type: 'win', description: 'Win a quick battle', required: 1 },
    ],
    reward: { crystals: 50, collectible: { id: 'bandit-token', name: 'Bandit Token', icon: '🏅', desc: 'Proof of bandit defeat' } },
  },
]

export const Default: Story = {
  args: {
    onClose: fn(),
    bountyDefs: sampleBounties,
    onAccept: fn(),
    onTurnIn: fn(),
  },
}

export const Empty: Story = {
  args: {
    onClose: fn(),
    bountyDefs: [],
    onAccept: fn(),
    onTurnIn: fn(),
  },
}
