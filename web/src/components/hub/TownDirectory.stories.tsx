import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TownDirectoryContent } from './TownDirectory'
import { RAVENWATCH } from '../../data/hub/hubTownStoryFixtures'

const meta = {
  component: TownDirectoryContent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <div className="satchel-sheet">
          <div className="satchel-sheet__body"><Story /></div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof TownDirectoryContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locationData: RAVENWATCH,
    pinnedNpcId:  null,
    onTogglePin:  fn(),
    onShowRelationship: fn(),
  },
}

export const WithPinned: Story = {
  args: {
    locationData: RAVENWATCH,
    pinnedNpcId:  RAVENWATCH.HUB_NPCS.find(n => n.name?.trim())?.id ?? null,
    onTogglePin:  fn(),
    onShowRelationship: fn(),
  },
}
