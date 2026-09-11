import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarGrid } from './AvatarGrid'

const meta = {
  component: AvatarGrid,
  title: 'Player/AvatarGrid',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AvatarGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Base: Story = {
  args: {
    entries: [
      { slug: 'jarv',       label: 'Blue Cloak',  unlocked: true },
      { slug: 'jarv-red',   label: 'Red Cloak',   unlocked: true },
      { slug: 'jarv-green', label: 'Green Cloak', unlocked: true },
      { slug: 'jarv-gold',  label: 'Gold Cloak',  unlocked: true },
    ],
    chosen: 'jarv',
    onChoose: fn(),
  },
}

export const WithLocked: Story = {
  args: {
    entries: [
      { slug: 'streak-iron',  label: 'Iron Streak',  unlocked: true },
      { slug: 'streak-flame', label: 'Flame Streak', unlocked: false },
      { slug: 'streak-void',  label: 'Void Streak',  unlocked: false },
    ],
    chosen: 'streak-iron',
    onChoose: fn(),
    lockHint: 'complete a win streak achievement',
  },
}
