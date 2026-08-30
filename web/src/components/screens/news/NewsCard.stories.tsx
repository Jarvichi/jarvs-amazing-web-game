import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { NewsCard } from './NewsCard'

const meta = {
  component: NewsCard,
  args: { onDismiss: fn() },
} satisfies Meta<typeof NewsCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    date: '25 Aug',
    item: {
      id: 'news-1',
      title: '🌈 Graham got a holofoil card!',
      body: 'Graham discovered Holo Drowned Automaton!',
      date: '2026-08-25',
      tag: 'EVENT',
    },
  },
}

export const Unread: Story = {
  args: { ...Default.args, unread: true },
}

export const Untagged: Story = {
  args: {
    date: '2 Jul 2025',
    item: {
      id: 'news-2',
      title: 'Server maintenance complete',
      body: 'Everything is back online.\n\nThanks for your patience.',
      date: '2025-07-02',
    },
  },
}
