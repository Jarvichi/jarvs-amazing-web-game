import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ListRow } from './ListRow'
import { EntityChip } from './EntityChip'

const meta = {
  component: ListRow,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { icon: '🪵', title: 'Pine Log', value: '×12' },
}

export const WithProgress: Story = {
  args: {
    icon: '📜',
    title: 'Bait for Greyfish',
    subtitle: 'Catch Greyfish',
    value: '2/4',
    progress: { current: 2, required: 4 },
    onClick: fn(),
  },
}

export const BountyProgress: Story = {
  args: {
    icon: '🎯',
    title: 'Cellar Sweep',
    subtitle: 'Clear the crates · +60 💎',
    value: '5/8',
    progress: { current: 5, required: 8, tone: 'gold' },
    onClick: fn(),
  },
}

export const WithActions: Story = {
  args: {
    icon: '🧭',
    title: 'Mira',
    subtitle: '📍 Market Row',
    actions: <EntityChip label="Show on map" icon="📍" onClick={fn()} />,
  },
}

export const Completed: Story = {
  args: { icon: '✅', title: 'Feed the Stray', value: '+40 💎', tone: 'dim' },
}
