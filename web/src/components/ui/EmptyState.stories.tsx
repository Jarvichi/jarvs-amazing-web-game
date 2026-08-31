import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmptyState } from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  decorators: [
    Story => (
      <div style={{ width: 320, border: '1px solid var(--border-edge)', background: 'var(--surface-1)' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof EmptyState>

export const Default: Story = { args: { children: 'No cards match the current filter.' } }

/** For a message inside a list or a short section. */
export const Small: Story = { args: { size: 'sm', children: 'No saved decks yet.' } }

export const WithHint: Story = {
  args: { children: 'Nothing here yet.', hint: 'Come back tomorrow.' },
}

export const WithIcon: Story = {
  args: { icon: '⏳', children: 'No scores yet — be the first!' },
}

export const WithIconAndHint: Story = {
  args: {
    icon: '🐟',
    children: "You haven't brought Corwin anything to appraise yet.",
    hint: 'Go catch some fish.',
  },
}

/**
 * A surface with its own palette retints it from an ancestor through
 * --empty-state-color rather than styling its own. The hub modals, the shelf
 * and the satchel sheet all do this.
 */
export const Retinted: Story = {
  args: { size: 'sm', children: 'No one notable lives here yet.' },
  decorators: [
    Story => (
      <div style={{ '--empty-state-color': 'var(--hub-text-dim)' } as React.CSSProperties}>
        <Story />
      </div>
    ),
  ],
}

/**
 * The reason it centres rather than sitting at the top: it is the only thing
 * in a panel that has room to spare, and a message pinned to the top edge of
 * an otherwise blank card reads as a loading state that stalled.
 */
export const FillsATallPanel: Story = {
  args: { children: 'No events recorded yet.', hint: 'Build, expand, and defend your city.' },
  decorators: [
    Story => (
      <div style={{ display: 'flex', flexDirection: 'column', height: 260 }}>
        <Story />
      </div>
    ),
  ],
}
