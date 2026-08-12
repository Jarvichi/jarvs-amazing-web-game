import type { Meta, StoryObj } from '@storybook/react-vite'
import { BountyBoardModal } from './BountyBoardModal'
import { getDailyBounties, acceptBounty, turnInBounty, advanceBountyStep, getActiveBountyStep, __setBountyNowOverride } from '../../game/hub/bounties'

/** Drives every step of a bounty to completion via advanceBountyStep. */
function completeAllSteps(id: string): void {
  let step = getActiveBountyStep(id)
  while (step) {
    advanceBountyStep(id)
    step = getActiveBountyStep(id)
  }
}

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
      __setBountyNowOverride(undefined)
      localStorage.removeItem('jarv_hub_bounties')
      return <Story />
    },
  ],
}

// A fixed date whose daily pool deterministically includes both a single-step
// 'report' bounty and the multi-step 'fresh-fish-for-the-kitchen' bounty.
const FISH_DAY = new Date('2026-01-02T12:00:00Z')

export const WithAcceptedBounty: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      __setBountyNowOverride(undefined)
      localStorage.removeItem('jarv_hub_bounties')
      const [bounty] = getDailyBounties()
      acceptBounty(bounty.id)
      // Turn In stays disabled until the bounty's report step is satisfied.
      return <Story />
    },
  ],
}

export const WithMultiStepBounty: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      // BountyBoardModal itself calls getDailyBounties() with no date, so "today"
      // must be pinned to FISH_DAY for the fish bounty to actually render.
      __setBountyNowOverride(FISH_DAY)
      localStorage.removeItem('jarv_hub_bounties')
      const fish = getDailyBounties(FISH_DAY).find(b => b.steps.length > 1)!
      acceptBounty(fish.id)
      advanceBountyStep(fish.id) // collect step done, report step still pending
      return <Story />
    },
  ],
}

export const WithReportedBounty: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      __setBountyNowOverride(undefined)
      localStorage.removeItem('jarv_hub_bounties')
      const [bounty] = getDailyBounties()
      acceptBounty(bounty.id)
      completeAllSteps(bounty.id)
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
      __setBountyNowOverride(undefined)
      localStorage.removeItem('jarv_hub_bounties')
      for (const bounty of getDailyBounties()) {
        acceptBounty(bounty.id)
        completeAllSteps(bounty.id)
        turnInBounty(bounty.id)
      }
      return <Story />
    },
  ],
}
