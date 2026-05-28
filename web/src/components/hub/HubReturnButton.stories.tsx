import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubReturnButton } from './HubReturnButton'

const meta = {
  component: HubReturnButton,
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 300, height: 80, background: '#1a2a1a' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubReturnButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { onClick: fn() },
}
