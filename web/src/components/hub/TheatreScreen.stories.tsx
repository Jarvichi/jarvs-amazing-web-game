import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TheatreScreen } from './TheatreScreen'

const meta = {
  component: TheatreScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TheatreScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
  },
}
