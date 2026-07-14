import type { Meta, StoryObj } from '@storybook/react-vite'
import { DoorAnimationDemo } from './DoorAnimationDemo'

const meta = {
  title: 'World/Door Animation',
  component: DoorAnimationDemo,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DoorAnimationDemo>

export default meta
type Story = StoryObj<typeof meta>

export const AllDoors: Story = {}
