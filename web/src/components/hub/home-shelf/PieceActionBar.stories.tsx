import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PieceActionBar } from './PieceActionBar'

const meta = {
  component: PieceActionBar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PieceActionBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { pieceName: 'Cozy Rug', removeArmed: false, onRotate: fn(), onMove: fn(), onRemove: fn() },
}

export const RemoveArmed: Story = {
  args: { pieceName: 'Cozy Rug', removeArmed: true, onRotate: fn(), onMove: fn(), onRemove: fn() },
}
