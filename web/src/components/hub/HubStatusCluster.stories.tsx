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

export const Clear: Story = {
  args: { areaName: 'The Courtyard', weather: 'clear' },
}

export const Rain: Story = {
  args: { areaName: "The Fisherman's Dock", weather: 'rain' },
}

export const Snow: Story = {
  args: { areaName: 'Frostgate Market', weather: 'snow' },
}

export const Fog: Story = {
  args: { areaName: 'The Old Quarry', weather: 'fog' },
}

export const Hidden: Story = {
  args: { areaName: null, weather: 'clear' },
}
