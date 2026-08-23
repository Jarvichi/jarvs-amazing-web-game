import { useState } from 'react'
import { within, userEvent, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SatchelNav } from './SatchelNav'
import type { SatchelSectionId } from './types'

function Interactive({ initial, badges }: { initial: SatchelSectionId; badges?: Partial<Record<SatchelSectionId, boolean>> }) {
  const [activeId, setActiveId] = useState<SatchelSectionId>(initial)
  return (
    <div className="satchel-sheet" style={{ height: 'auto', display: 'block' }}>
      <SatchelNav activeId={activeId} onSelect={setActiveId} badges={badges} />
    </div>
  )
}

const meta = {
  component: Interactive,
  tags: ['ci'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { initial: 'today' } }
export const QuestsSelected: Story = { args: { initial: 'quests' } }

/** An attention dot marks a section with something new since the last visit. */
export const WithBadges: Story = { args: { initial: 'today', badges: { codex: true, quests: true } } }

/** The old tab strip was plain buttons: no tablist role, no aria-selected, no
 *  keyboard movement. Asserting it here so that can't quietly regress. */
export const KeyboardNavigation: Story = {
  args: { initial: 'today' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = canvas.getAllByRole('tab')
    expect(tabs).toHaveLength(5)

    const [today, satchel] = tabs
    expect(today).toHaveAttribute('aria-selected', 'true')
    // Only the selected tab is in the tab order — the rest are arrow-reachable.
    expect(today).toHaveAttribute('tabindex', '0')
    expect(satchel).toHaveAttribute('tabindex', '-1')

    today.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(canvas.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true')

    // Arrow movement wraps rather than dead-ending at either edge.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(canvas.getAllByRole('tab')[4]).toHaveAttribute('aria-selected', 'true')
  },
}
