import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArchetypeGrid } from './ArchetypeGrid'

const meta = {
  component: ArchetypeGrid,
  title: 'Player/ArchetypeGrid',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ArchetypeGrid>

export default meta
type Story = StoryObj<typeof meta>

const DEFS = [
  { id: 'siege_commander' as const, name: 'Siege Commander', icon: '🏰', identity: 'Structures win wars', passive: 'Structures cost 1 less mana. Structure HP +20%.', locked: false },
  { id: 'swarm_tactician' as const, name: 'Swarm Tactician', icon: '🐝', identity: 'Quantity is quality', passive: 'Units cost 1 less when 4+ are on the field. +5% ATK per unit alive.', locked: false },
  { id: 'arcane_scholar' as const, name: 'Arcane Scholar', icon: '📜', identity: 'Upgrades shape reality', passive: 'Upgrade cards have double effect. Draw +1 card after each upgrade played.', locked: true },
]

export const Default: Story = {
  args: { defs: DEFS, selected: 'siege_commander', onChoose: fn() },
}
