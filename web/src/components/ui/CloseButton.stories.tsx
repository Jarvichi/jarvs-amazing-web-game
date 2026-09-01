import type { Meta, StoryObj } from '@storybook/react-vite'
import { CloseButton } from './CloseButton'
import { IconSprite } from './icons/IconSprite'

const meta: Meta<typeof CloseButton> = {
  title: 'UI/CloseButton',
  component: CloseButton,
  decorators: [
    Story => (
      <div style={{ padding: 24, background: 'var(--surface-1)' }}>
        <IconSprite />
        <Story />
      </div>
    ),
  ],
  args: { onClick: () => {} },
}
export default meta

type Story = StoryObj<typeof CloseButton>

export const Ghost: Story = {}

export const Framed: Story = { args: { variant: 'framed' } }

/** The size a full-width sheet header uses, rather than a dense modal row. */
export const GhostLarge: Story = { args: { size: 16 } }

/**
 * A surface with its own palette retints the control through
 * --close-btn-color / --close-btn-color-on instead of restyling it. This is
 * what the four hub modals and the satchel sheet do.
 */
export const Retinted: Story = {
  decorators: [
    Story => (
      <div
        style={{
          padding: 24,
          background: 'var(--surface-1)',
          '--close-btn-color': 'var(--hub-text-dim)',
          '--close-btn-color-on': 'var(--hub-text-on)',
        } as React.CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
}

/**
 * In a header row, which is where every real call site puts it: the ghost
 * variant's negative margin cancels its own touch padding, so the glyph sits
 * flush with the row's right edge rather than 12px in from it.
 */
export const InHeaderRow: Story = {
  render: args => (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        border: '1px solid var(--border-edge)',
        background: 'var(--surface-2)',
        width: 280,
      }}
    >
      <span style={{ flex: 1, fontSize: 12, letterSpacing: '0.08em' }}>QUESTS</span>
      <CloseButton {...args} />
    </div>
  ),
}
