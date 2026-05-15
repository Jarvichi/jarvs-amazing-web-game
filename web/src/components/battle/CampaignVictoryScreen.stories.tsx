import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CampaignVictoryScreen } from './CampaignVictoryScreen';

const meta = {
  component: CampaignVictoryScreen,
} satisfies Meta<typeof CampaignVictoryScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onBeginAnew": fn()
  },
};