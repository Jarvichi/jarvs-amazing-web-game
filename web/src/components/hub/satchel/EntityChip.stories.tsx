import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { EntityChip } from './EntityChip'

const meta = {
  component: EntityChip,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof EntityChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: 'Mira', onClick: fn() } }
export const Actionable: Story = { args: { label: 'Ready to hand in', tone: 'gold', onClick: fn() } }
export const AnotherTown: Story = { args: { label: 'Saltmere Port', icon: '🧭', tone: 'away', onClick: fn() } }
export const PassiveLabel: Story = { args: { label: 'bounty', tone: 'quiet' } }
export const Travelling: Story = { args: { label: 'Grondle', tone: 'away', onClick: fn(), disabled: true, title: "Travelling — can't be pinned right now" } }
