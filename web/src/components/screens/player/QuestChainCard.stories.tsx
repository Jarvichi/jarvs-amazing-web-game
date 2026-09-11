import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestChainCard } from './QuestChainCard'
import type { QuestChainStatus } from '../../../game/quests'

const meta = {
  component: QuestChainCard,
  title: 'Player/QuestChainCard',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof QuestChainCard>

export default meta
type Story = StoryObj<typeof meta>

const IN_PROGRESS: QuestChainStatus = {
  def: {
    id: 'story-quest',
    name: 'The Fracture Hunt',
    icon: '🗡',
    theme: 'story',
    intro: 'Something ancient stirs beneath the Shattered Dominion. Few have gone looking for it.',
    targetCard: 'Fracture Blade',
    steps: [
      { label: 'Win 5 battles', condition: { type: 'win_battles', count: 5 } },
      { label: 'Play 10 unit cards', condition: { type: 'play_card_type', cardType: 'unit', count: 10 } },
      { label: 'Defeat the Act 1 boss', condition: { type: 'defeat_boss', actId: 'act1' } },
    ],
  },
  stepProgress: [5, 6, 0],
  activeStep: 2,
  completed: false,
}

const COMPLETED: QuestChainStatus = {
  ...IN_PROGRESS,
  stepProgress: [5, 10, 1],
  activeStep: 3,
  completed: true,
}

export const InProgress: Story = { args: { status: IN_PROGRESS } }
export const Completed: Story = { args: { status: COMPLETED } }
