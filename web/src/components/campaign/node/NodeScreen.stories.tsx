import type { Meta, StoryObj } from '@storybook/react-vite'
import { NodeScreen } from './NodeScreen'
import { Button } from '../../ui/Button'

const meta = {
  component: NodeScreen,
  title: 'Campaign/Node/NodeScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <div className="game-container" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof NodeScreen>

export default meta
type Story = StoryObj<typeof meta>

export const WithStatsAndActions: Story = {
  args: {
    title: '— CAMP —',
    stats: { hp: 32, maxHp: 50, lives: 2, maxLives: 3 },
    children: <div style={{ padding: 12 }}>Node content goes here.</div>,
    actions: <Button size="lg">CONTINUE</Button>,
  },
}

export const TitleOnly: Story = {
  args: {
    title: 'CHOOSE YOUR RELIC',
    children: <div style={{ padding: 12 }}>Node content goes here.</div>,
    actions: <Button size="lg">CONFIRM</Button>,
  },
}
