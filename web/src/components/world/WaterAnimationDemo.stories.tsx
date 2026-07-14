import type { Meta, StoryObj } from '@storybook/react-vite'
import { WaterAnimationDemo } from './WaterAnimationDemo'

const meta = {
  title: 'World/Water Animation',
  component: WaterAnimationDemo,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WaterAnimationDemo>

export default meta
type Story = StoryObj<typeof meta>

export const AllWater: Story = {}
