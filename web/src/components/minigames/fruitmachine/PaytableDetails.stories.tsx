import type { Meta, StoryObj } from '@storybook/react-vite'
import { PaytableDetails } from './PaytableDetails'

const meta = {
  component: PaytableDetails,
} satisfies Meta<typeof PaytableDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    featureThreshold: 5,
    featureBonusCredits: 15,
  },
}
