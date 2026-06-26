import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TownJournal } from './TownJournal'
import { RAVENWATCH } from '../../data/hub/hubWorldFactory'

const meta = {
  component: TownJournal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TownJournal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onClose: fn(),
    locationData: RAVENWATCH,
  },
}
