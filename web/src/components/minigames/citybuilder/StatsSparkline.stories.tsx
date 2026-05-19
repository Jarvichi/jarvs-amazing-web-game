import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatsSparkline } from './StatsSparkline'

const meta = {
  component: StatsSparkline,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StatsSparkline>

export default meta
type Story = StoryObj<typeof meta>

const growingData  = [10, 12, 15, 14, 18, 22, 25, 24, 28, 30, 35, 38, 40, 42, 45]
const volatileData = [30, 45, 20, 55, 10, 60, 35, 50, 25, 70, 15, 65, 40, 55, 30]

export const NoData: Story = {
  args: {
    data: [42],
    color: '#ffd700',
  },
}

export const GoldOverTime: Story = {
  args: {
    data: growingData,
    color: '#ffd700',
  },
}

export const WithCapacity: Story = {
  args: {
    data: growingData,
    color: '#4caf50',
    capacity: 50,
    formatCapacity: (n: number) => `${n} wheat`,
  },
}

export const WithAttacks: Story = {
  args: {
    data: volatileData,
    color: '#ff6644',
    attacks: volatileData.map((_, i) => i === 3 || i === 9),
  },
}
