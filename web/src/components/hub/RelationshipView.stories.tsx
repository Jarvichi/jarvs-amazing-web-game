import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RelationshipView } from './RelationshipView'
import type { RelationshipEntry } from '../../game/hub/relationships'

const meta = {
  component: RelationshipView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RelationshipView>

export default meta
type Story = StoryObj<typeof meta>

const entry = (
  track: RelationshipEntry['track'],
  level: number,
  points: Partial<RelationshipEntry['points']> = {},
): RelationshipEntry => ({
  track,
  level,
  points: { ally: 0, rival: 0, romance: 0, ...points },
})

export const Acquaintance: Story = {
  args: { npcName: 'Elder Maeve', entry: entry(null, 0), onClose: fn() },
}

export const Ally: Story = {
  args: { npcName: 'Elder Maeve', entry: entry('ally', 2, { ally: 14 }), onClose: fn() },
}

export const Rival: Story = {
  args: { npcName: 'Captain Roth', entry: entry('rival', 3, { rival: 32 }), onClose: fn() },
}

export const Romance: Story = {
  args: { npcName: 'Naia', entry: entry('romance', 4, { romance: 60 }), onClose: fn() },
}

export const Maxed: Story = {
  args: { npcName: 'Naia', entry: entry('romance', 5, { romance: 120 }), onClose: fn() },
}
