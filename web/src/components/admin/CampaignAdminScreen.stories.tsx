import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CampaignAdminScreen } from './CampaignAdminScreen';

const meta = {
  component: CampaignAdminScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CampaignAdminScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
