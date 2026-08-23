import { useState } from 'react'
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
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { initial: 'today' } }
export const QuestsSelected: Story = { args: { initial: 'quests' } }

/** An attention dot marks a section with something new since the last visit. */
export const WithBadges: Story = { args: { initial: 'today', badges: { codex: true, quests: true } } }
