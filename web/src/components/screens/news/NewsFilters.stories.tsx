import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { NewsFilters } from './NewsFilters'

const meta = {
  component: NewsFilters,
  args: { onChange: fn() },
} satisfies Meta<typeof NewsFilters>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    activeId: 'all',
    options: [
      { id: 'all',         label: 'All',      count: 24 },
      { id: 'EVENT',       label: 'Events',   count: 14 },
      { id: 'UPDATE',      label: 'Updates',  count: 6 },
      { id: 'NEW FEATURE', label: 'Features', count: 3 },
      { id: 'BUG FIX',     label: 'Fixes',    count: 1 },
    ],
  },
}

export const TagSelected: Story = {
  args: { ...Default.args, activeId: 'EVENT' },
}

/** Only 'All' would be offered, so the row hides itself entirely. */
export const SingleOption: Story = {
  args: { activeId: 'all', options: [{ id: 'all', label: 'All', count: 3 }] },
}
