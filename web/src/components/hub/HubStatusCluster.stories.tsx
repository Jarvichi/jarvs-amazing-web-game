import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubStatusCluster } from './HubStatusCluster'

const meta = {
  component: HubStatusCluster,
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 400, height: 200, background: '#1a2a1a' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubStatusCluster>

export default meta
type Story = StoryObj<typeof meta>

export const Named: Story = {
  args: { areaName: 'The Courtyard' },
}

/** Long names still sit flush to the canvas's right edge. */
export const LongName: Story = {
  args: { areaName: "The Fisherman's Dock" },
}

/** Between areas the label fades out rather than popping. */
export const Hidden: Story = {
  args: { areaName: null },
}
