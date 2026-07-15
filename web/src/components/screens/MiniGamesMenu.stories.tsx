import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MiniGamesMenu } from './MiniGamesMenu';
import { getTodayDate } from '../../game/miniGames';

const meta = {
  component: MiniGamesMenu,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MiniGamesMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

const DAILY_CHALLENGE_KEY = 'jarv_minigame_daily_challenge';

export const Default: Story = {
  args: {
    crystals: 100,
    onCrystalsChange: fn(),
    user: null,
    characterName: 'Player 1',
    onBack: fn(),
  },
  decorators: [(Story) => {
    localStorage.removeItem(DAILY_CHALLENGE_KEY);
    return <Story />;
  }],
};

export const DailyChallengeClaimed: Story = {
  args: {
    crystals: 100,
    onCrystalsChange: fn(),
    user: null,
    characterName: 'Player 1',
    onBack: fn(),
  },
  decorators: [(Story) => {
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify({
      date: getTodayDate(),
      claimed: ['marble', 'tileflip'],
    }));
    return <Story />;
  }],
};
