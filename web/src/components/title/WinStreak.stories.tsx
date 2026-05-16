import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WinStreak, WinStreakProps } from './WinStreak';

const meta = {
  component: WinStreak,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WinStreak>;

export default meta;

type Story = StoryObj<typeof meta>;

const defaultProps: WinStreakProps = {
  winStreak: 3,
  bestStreak: 5,
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};

export const NoWinStreak: Story = {
  args: {
    ...defaultProps,
    winStreak: 0,
    bestStreak: 0,
  },
};

export const NoWinStreakButBest: Story = {
  args: {
    ...defaultProps,    winStreak: 0,
    bestStreak: 7,
  },
};

