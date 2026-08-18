import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from 'firebase/auth';

import { TitleIdentityFooter } from './TitleIdentityFooter';

const meta = {
  component: TitleIdentityFooter,
  parameters: { layout: 'centered' },
  title: 'Title/TitleIdentityFooter',
} satisfies Meta<typeof TitleIdentityFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = { onSignIn: fn(), onSignOut: fn(), onFeedback: fn() };

export const SignedOut: Story = {
  args: {
    ...callbacks,
    playerName: 'Jarv',
    bestStreak: 0,
    cardsLabel: '11/960',
    crystalsLabel: '250',
    deckLabel: '14',
    glitch: false,
    user: null,
  },
};

export const WithStreak: Story = {
  args: {
    ...callbacks,
    playerName: 'Jarv',
    bestStreak: 7,
    cardsLabel: '84/960',
    crystalsLabel: '1,234',
    deckLabel: '20',
    glitch: false,
    user: null,
  },
};

export const LoggedIn: Story = {
  args: {
    ...callbacks,
    playerName: 'Jarv',
    bestStreak: 7,
    cardsLabel: '84/960',
    crystalsLabel: '1,234',
    deckLabel: '20',
    glitch: false,
    user: { uid: 'preview-user', displayName: 'Jarv', email: 'jarv@example.com', isAnonymous: false } as User,
  },
};

export const GlitchState: Story = {
  args: {
    ...callbacks,
    playerName: 'Jarv',
    bestStreak: 7,
    cardsLabel: '412/960',
    crystalsLabel: '9,981',
    deckLabel: '7',
    glitch: true,
    user: null,
  },
};
