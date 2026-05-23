import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from 'firebase/auth';

import { TitleScreen, Props } from './TitleScreen';

const meta = {
  component: TitleScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TitleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = {
  onPlay: fn(),
  onEndless: fn(),
  onCampaign: fn(),
  onCollection: fn(),
  onShop: fn(),
  onDeckBuilder: fn(),
  onSettings: fn(),
  onInventory: fn(),
  onAchievements: fn(),
  onHeroCards: fn(),
  onCharacter: fn(),
  onDailyChallenge: fn(),
  onEndlessLeaderboard: fn(),
  onTraining: fn(),
  onNews: fn(),
  onMiniGames: fn(),
  onPlayerStats: fn(),
  onCodex: fn(),
  onSignOut: fn(),
  onSignIn: fn(),
  onFeedback: fn(),
  onCityBuilder: fn(),
};

const defaultProps: Props = {
  ...callbacks,
  crystals: 250,
  user: null,
  hasUnreadNews: false,
};

export const Default: Story = {
  args: {
    ...defaultProps,
    crystals: 250,
    user: null,
    hasUnreadNews: false,
  },
};

export const WithUnreadNews: Story = {
  args: {
    ...defaultProps,
    crystals: 250,
    user: null,
    hasUnreadNews: true,
  },
};

export const WithCommander: Story = {
  args: {
    ...defaultProps,
    crystals: 1200,
    user: null,
    hasUnreadNews: false,
    commanderName: 'Valeria',
    onCommander: fn(),
  },
};

export const LoggedIn: Story = {
  args: {
    ...defaultProps,
    crystals: 1234,
    user: {
      uid:         'preview-user',
      displayName: 'Andrew',
      email:       'andrewglawson@gmail.com',
      isAnonymous: false,
    } as User,
  },
};
