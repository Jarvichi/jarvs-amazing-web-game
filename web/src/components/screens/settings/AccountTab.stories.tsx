import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from 'firebase/auth';

import { AccountTab } from './AccountTab';

const meta = {
  component: AccountTab,
  title: 'Settings/AccountTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AccountTab>;

export default meta;

type Story = StoryObj<typeof meta>;

const anonUser   = { isAnonymous: true } as User;
const signedInUser = {
  isAnonymous: false,
  displayName: 'Jarv',
  email: 'jarv@example.com',
  uid: 'demo-uid',
} as User;

export const SignedOut: Story = {
  args: { user: anonUser, authLoading: false },
};

export const AuthLoading: Story = {
  args: { user: anonUser, authLoading: true },
};

export const SignedIn: Story = {
  args: { user: signedInUser, authLoading: false },
};

/** The delete row needs a real account — it must not appear for a null or
 *  anonymous user, even though both take the signed-in branch. */
export const NoUser: Story = {
  args: { user: null, authLoading: false },
};
