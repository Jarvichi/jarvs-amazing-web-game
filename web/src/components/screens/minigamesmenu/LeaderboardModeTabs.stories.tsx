import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LeaderboardModeTabs } from './LeaderboardModeTabs';

const meta = {
  component: LeaderboardModeTabs,
} satisfies Meta<typeof LeaderboardModeTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Today: Story = {
  args: {
    mode: 'today',
    onChange: fn(),
  },
};

export const AllTime: Story = {
  args: {
    mode: 'allTime',
    onChange: fn(),
  },
};
