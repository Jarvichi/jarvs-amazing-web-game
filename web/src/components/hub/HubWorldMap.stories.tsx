import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorldMap } from './HubWorldMap'

const meta = {
  component: HubWorldMap,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubWorldMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSelectNode: fn(),
    onBack:       fn(),
    onFeedback:   fn(),
    user:         null,
  },
}
