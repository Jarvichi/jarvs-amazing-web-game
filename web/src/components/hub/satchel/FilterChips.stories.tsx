import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FilterChips, type FilterOption } from './FilterChips'

const QUEST_FILTERS: FilterOption[] = [
  { id: 'active',   label: 'Active',   count: 2 },
  { id: 'ready',    label: 'Ready',    count: 1 },
  { id: 'bounties', label: 'Bounties', count: 1 },
  { id: 'done',     label: 'Done',     count: 108 },
]

function Interactive({ options }: { options: FilterOption[] }) {
  const [activeId, setActiveId] = useState(options[0].id)
  return <FilterChips options={options} activeId={activeId} onChange={setActiveId} label="Filter quests" />
}

const meta = {
  component: Interactive,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { options: QUEST_FILTERS } }

/** Chips scroll sideways rather than wrapping — never more than one line. */
export const Overflowing: Story = {
  args: {
    options: [
      { id: 'all', label: 'All', count: 122 },
      ...QUEST_FILTERS,
      { id: 'ravenwatch', label: 'Ravenwatch', count: 14 },
      { id: 'saltmere', label: 'Saltmere Port', count: 9 },
      { id: 'gearford', label: 'Gearford', count: 11 },
    ],
  },
}
