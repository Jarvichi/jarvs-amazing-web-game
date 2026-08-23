import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActionCard } from './ActionCard'
import { EntityChip } from './EntityChip'

const meta = {
  component: ActionCard,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof ActionCard>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyToHandIn: Story = {
  args: {
    title: "The Merchant's Ingredient — ready",
    detail: <>Hand Moonleaf Herb to <EntityChip label="Mira" onClick={fn()} /> · Market Row</>,
    actionLabel: 'SHOW ON MAP',
    onAction: fn(),
  },
}

export const Tribute: Story = {
  args: { title: 'Tribute is waiting', detail: '+120 💎 from Ravenwatch · today only', actionLabel: 'COLLECT', onAction: fn() },
}

/** Quiet tone: real, but not actionable from where the player is standing. */
export const WaitingElsewhere: Story = {
  args: {
    title: "The Scholar's Anthology — ready",
    detail: <>Hand to <EntityChip label="Aldric" tone="away" onClick={fn()} /> in <EntityChip label="Saltmere Port" icon="🧭" tone="away" onClick={fn()} /></>,
    tone: 'quiet',
  },
}
