import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChoiceCard } from './ChoiceCard'

const meta = {
  component: ChoiceCard,
  title: 'Campaign/Node/ChoiceCard',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChoiceCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { icon: '🛡', name: 'Bark Shield', desc: 'Your base gains +10 max HP at the start of every battle.', chosen: false, onClick: fn() },
}

export const Chosen: Story = {
  args: { icon: '🛡', name: 'Bark Shield', desc: 'Your base gains +10 max HP at the start of every battle.', chosen: true, onClick: fn() },
}

export const Exotic: Story = {
  args: { icon: '🌀', name: 'Fracture Core', desc: 'Rule-breaking exotic effect.', chosen: false, exotic: true, onClick: fn() },
}
