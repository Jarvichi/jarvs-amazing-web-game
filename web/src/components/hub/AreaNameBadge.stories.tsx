import type { Meta, StoryObj } from '@storybook/react-vite'
import { AreaNameBadge } from './AreaNameBadge'

const meta = {
  component: AreaNameBadge,
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 400, height: 200, background: '#1a2a1a' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AreaNameBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Visible: Story = {
  args: { name: 'The Courtyard' },
}

export const Hidden: Story = {
  args: { name: null },
}

export const LongName: Story = {
  args: { name: "The Fisherman's Dock" },
}
