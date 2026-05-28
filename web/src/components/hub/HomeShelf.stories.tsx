import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomeShelf } from './HomeShelf'

const meta = {
  component: HomeShelf,
} satisfies Meta<typeof HomeShelf>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
  },
}
