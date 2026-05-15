import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CampaignFailedScreen } from './CampaignFailedScreen';

const meta = {
  component: CampaignFailedScreen,
} satisfies Meta<typeof CampaignFailedScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onReturnToMenu": fn()
  },
};