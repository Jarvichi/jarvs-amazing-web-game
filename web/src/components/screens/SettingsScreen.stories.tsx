import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsScreen } from './SettingsScreen';

const meta = {
  component: SettingsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SettingsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  args: {
    onBack: fn(),
    onResetGame: fn(),
    user: null,
    authLoading: false,
  },
};

export const Loading: Story = {
  args: {
    onBack: fn(),
    onResetGame: fn(),
    user: null,
    authLoading: true,
  },
};

export const WithAdminOptions: Story = {
  args: {
    onBack: fn(),
    onResetGame: fn(),
    user: null,
    authLoading: false,
    onGiftAdmin: fn(),
    onNewsAdmin: fn(),
    onCampaignAdmin: fn(),
    onFeedbackAdmin: fn(),
  },
};
