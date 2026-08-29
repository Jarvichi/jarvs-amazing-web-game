import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from 'firebase/auth';

import { SettingsScreen } from './SettingsScreen';
import { GIFT_OWNER_UID } from '../../game/gifts';

const meta = {
  component: SettingsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SettingsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const base = {
  onBack: fn(),
  onResetGame: fn(),
  authLoading: false,
};

const signedInUser = {
  isAnonymous: false,
  displayName: 'Jarv',
  email: 'jarv@example.com',
  uid: 'demo-uid',
} as User;

export const LoggedOut: Story = {
  args: { ...base, user: null },
};

export const Loading: Story = {
  args: { ...base, user: null, authLoading: true },
};

export const SignedIn: Story = {
  args: { ...base, user: signedInUser },
};

/** The owner account, which is the only one that gets the Admin tab. */
export const WithAdminOptions: Story = {
  args: {
    ...base,
    user: { isAnonymous: false, uid: GIFT_OWNER_UID } as User,
    onGiftAdmin: fn(),
    onNewsAdmin: fn(),
    onCampaignAdmin: fn(),
    onFeedbackAdmin: fn(),
    onTownAccessAdmin: fn(),
    onHubWorld: fn(),
    onCheckForUpdates: fn(async () => {}),
  },
};
