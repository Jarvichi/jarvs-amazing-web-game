import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ToBeContinuedScreen } from './ToBeContinuedScreen'

const meta = {
  title: 'Battle/ToBeContinuedScreen',
  component: ToBeContinuedScreen,
} satisfies Meta<typeof ToBeContinuedScreen>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    campaignName: 'The Forgotten Kingdom',
    onContinue: fn(),
  },
}
