import type { Meta, StoryObj } from '@storybook/react-vite'
import { NodeStatsStrip } from './NodeStatsStrip'

const meta = {
  component: NodeStatsStrip,
  title: 'Campaign/Node/NodeStatsStrip',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NodeStatsStrip>

export default meta
type Story = StoryObj<typeof meta>

export const HpOnly: Story = { args: { hp: 32, maxHp: 50 } }
export const HpAndLives: Story = { args: { hp: 32, maxHp: 50, lives: 2, maxLives: 3 } }
