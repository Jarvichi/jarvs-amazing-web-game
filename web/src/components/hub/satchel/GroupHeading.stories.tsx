import type { Meta, StoryObj } from '@storybook/react-vite'
import { GroupHeading } from './GroupHeading'

const meta = {
  component: GroupHeading,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof GroupHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: 'In progress', count: 2 } }
export const Actionable: Story = { args: { children: 'Ready to hand in', count: 1, tone: 'gold' } }
