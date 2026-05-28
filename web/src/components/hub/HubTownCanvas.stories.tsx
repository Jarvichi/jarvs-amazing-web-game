import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTownCanvas } from './HubTownCanvas'

const meta = {
  component: HubTownCanvas,
} satisfies Meta<typeof HubTownCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onAreaEnter: fn(),
  },
}
