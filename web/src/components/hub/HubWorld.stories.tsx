import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorld } from './HubWorld'

const meta = {
  component: HubWorld,
} satisfies Meta<typeof HubWorld>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
  },
}
