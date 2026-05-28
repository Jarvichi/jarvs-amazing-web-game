import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HallOfAchievements } from './HallOfAchievements'

const meta = {
  component: HallOfAchievements,
} satisfies Meta<typeof HallOfAchievements>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack:            fn(),
    onCrystalsChanged: fn(),
  },
}
