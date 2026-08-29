import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from 'firebase/auth';

import { AdminTab } from './AdminTab';
import { GIFT_OWNER_UID } from '../../../game/gifts';

const meta = {
  component: AdminTab,
  title: 'Settings/AdminTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AdminTab>;

export default meta;

type Story = StoryObj<typeof meta>;

// The real owner uid — the panels below are gated on it, so a placeholder
// would render an empty tab.
const ownerUser = { isAnonymous: false, uid: GIFT_OWNER_UID } as User;

/** What a signed-out, non-owner visitor sees — nothing but the dev menu. */
export const NotOwner: Story = {
  args: { user: null },
};

export const WithAdminPanels: Story = {
  args: {
    user: ownerUser,
    onGiftAdmin: fn(),
    onNewsAdmin: fn(),
    onCampaignAdmin: fn(),
    onFeedbackAdmin: fn(),
    onTownAccessAdmin: fn(),
    onHubWorld: fn(),
  },
};
