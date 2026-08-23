import type { Meta, StoryObj } from '@storybook/react-vite'
import { TownJournalContent } from './TownJournal'
import { RAVENWATCH } from '../../data/hub/hubTownStoryFixtures'

const meta = {
  component: TownJournalContent,
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
} satisfies Meta<typeof TownJournalContent>

export default meta
type Story = StoryObj<typeof meta>

/** The category is chosen by the Codex section's chip row, so each category
 *  gets its own story rather than hiding behind an internal tab bar. */
export const Animals: Story = { args: { locationData: RAVENWATCH, tab: 'animals' } }
export const Fish:    Story = { args: { locationData: RAVENWATCH, tab: 'fish' } }
export const People:  Story = { args: { locationData: RAVENWATCH, tab: 'people' } }
export const Places:  Story = { args: { locationData: RAVENWATCH, tab: 'places' } }
