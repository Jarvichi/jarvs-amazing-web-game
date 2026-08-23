import type { Meta, StoryObj } from '@storybook/react-vite'
import { CollapsibleGroup } from './CollapsibleGroup'
import { ListRow } from './ListRow'

const DONE = [
  { title: 'Feed the Stray',      reward: '+40 💎' },
  { title: "Where's Rover?",      reward: '+35 💎' },
  { title: "Pip's Treasures",     reward: '+35 💎' },
  { title: 'The Lost Pendants',   reward: '+50 💎' },
]

const meta = {
  component: CollapsibleGroup,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof CollapsibleGroup>

export default meta
type Story = StoryObj<typeof meta>

const rows = DONE.map(q => <ListRow key={q.title} icon="✅" title={q.title} value={q.reward} tone="dim" />)

/** 108 completed quests as one tappable line — the fix for the old flat list. */
export const Collapsed: Story = { args: { title: '✅ Completed', count: 108, children: rows } }
export const Expanded: Story = { args: { title: '✅ Completed', count: 108, defaultOpen: true, children: rows } }
