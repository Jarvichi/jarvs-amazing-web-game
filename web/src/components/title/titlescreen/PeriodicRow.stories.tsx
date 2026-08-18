import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PeriodicRow } from './PeriodicRow';

const meta = {
  component: PeriodicRow,
  parameters: { layout: 'centered' },
  title: 'Title/PeriodicRow',
} satisfies Meta<typeof PeriodicRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotPlayedYet: Story = {
  args: {
    dailyLabel: 'DAILY CHALLENGE',
    dailyStreak: 0,
    dailyResetLabel: 'resets in 6h',
    onDaily: fn(),
    weeklyLabel: 'WEEKLY CHALLENGE',
    weeklyResetLabel: 'resets in 3d',
    onWeekly: fn(),
    onLeaderboards: fn(),
  },
};

export const WonWithStreak: Story = {
  args: {
    dailyLabel: 'DAILY ✓',
    dailyStreak: 12,
    dailyResetLabel: 'resets in 6h',
    onDaily: fn(),
    weeklyLabel: 'WEEKLY ✓',
    weeklyResetLabel: 'resets in 3d',
    onWeekly: fn(),
    onLeaderboards: fn(),
  },
};

export const Attempted: Story = {
  args: {
    dailyLabel: 'DAILY (2)',
    dailyStreak: 3,
    dailyResetLabel: 'resets in 1h',
    onDaily: fn(),
    weeklyLabel: 'WEEKLY (1)',
    weeklyResetLabel: 'resets in 12h',
    onWeekly: fn(),
    onLeaderboards: fn(),
  },
};
