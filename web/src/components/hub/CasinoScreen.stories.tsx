import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CasinoScreen } from './CasinoScreen'

const meta = {
  component: CasinoScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CasinoScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    crystals:         250,
    onCrystalsChange: fn(),
    onBack:           fn(),
  },
}

export const NotEnoughCrystals: Story = {
  args: {
    crystals:         5,
    onCrystalsChange: fn(),
    onBack:           fn(),
  },
}
