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

export const ClearDay: Story = {
  args: { areaName: 'The Courtyard', isNight: false, timeLabel: '2:30 PM', weather: 'clear' },
}

export const ClearNight: Story = {
  args: { areaName: 'The Courtyard', isNight: true, timeLabel: '10:45 PM', weather: 'clear' },
}

export const Rain: Story = {
  args: { areaName: "The Fisherman's Dock", isNight: false, timeLabel: '4:10 PM', weather: 'rain' },
}

export const SnowAtNight: Story = {
  args: { areaName: 'Frostgate Market', isNight: true, timeLabel: '9:00 PM', weather: 'snow' },
}

export const Fog: Story = {
  args: { areaName: 'The Old Quarry', isNight: false, timeLabel: '6:20 AM', weather: 'fog' },
}

export const Hidden: Story = {
  args: { areaName: null, isNight: false, timeLabel: '12:00 PM', weather: 'clear' },
}
