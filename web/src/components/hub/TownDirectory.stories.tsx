import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TownDirectory } from './TownDirectory'
import { RAVENWATCH } from '../../data/hub/hubTownStoryFixtures'

const meta = {
  component: TownDirectory,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TownDirectory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onClose:     fn(),
    locationData: RAVENWATCH,
    pinnedNpcId:  null,
    onTogglePin:  fn(),
    onShowRelationship: fn(),
  },
}

export const WithPinned: Story = {
  args: {
    onClose:     fn(),
    locationData: RAVENWATCH,
    pinnedNpcId:  RAVENWATCH.HUB_NPCS.find(n => n.name?.trim())?.id ?? null,
    onTogglePin:  fn(),
    onShowRelationship: fn(),
  },
}
