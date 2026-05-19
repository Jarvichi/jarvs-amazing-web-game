import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResourceChip } from './ResourceChip'

const meta = {
  component: ResourceChip,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ResourceChip>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {
  args: {
    res: 'wheat',
    stock: 45,
    cap: 100,
    prod: 8,
    cons: 3,
  },
}

export const Deficit: Story = {
  args: {
    res: 'bread',
    stock: 12,
    cap: 80,
    prod: 2,
    cons: 6,
  },
}

export const NearCap: Story = {
  args: {
    res: 'wood',
    stock: 75,
    cap: 100,
    prod: 5,
    cons: 0,
  },
}

export const Empty: Story = {
  args: {
    res: 'ore',
    stock: 0,
    cap: 50,
    prod: 0,
    cons: 0,
  },
}
