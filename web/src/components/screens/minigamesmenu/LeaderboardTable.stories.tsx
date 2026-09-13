import type { Meta, StoryObj } from '@storybook/react-vite';

import { LeaderboardTable } from './LeaderboardTable';

const meta = {
  component: LeaderboardTable,
} satisfies Meta<typeof LeaderboardTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loading: true,
    entries: [],
  },
};

export const Empty: Story = {
  args: {
    loading: false,
    entries: [],
  },
};

export const WithEntries: Story = {
  args: {
    loading: false,
    entries: [
      { uid: 'u1', characterName: 'Aria', score: 980, achievedAt: new Date() },
      { uid: 'u2', characterName: 'Boros', score: 760, achievedAt: new Date() },
      { uid: 'u3', characterName: 'Cass', score: 640, achievedAt: new Date() },
    ],
  },
};
