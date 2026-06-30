import type { Meta, StoryObj } from '@storybook/react-vite'
import { BountyBoardModal } from './BountyBoardModal'
import { getDailyBounties, acceptBounty, turnInBounty } from '../../game/hub/bounties'

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

export const Default: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      localStorage.removeItem('jarv_hub_bounties')
      return <Story />
    },
  ],
}

export const WithAcceptedBounty: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      localStorage.removeItem('jarv_hub_bounties')
      const [bounty] = getDailyBounties()
      acceptBounty(bounty.id)
      return <Story />
    },
  ],
}

export const AllCompleted: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      localStorage.removeItem('jarv_hub_bounties')
      for (const bounty of getDailyBounties()) {
        acceptBounty(bounty.id)
        turnInBounty(bounty.id)
      }
      return <Story />
    },
  ],
}
