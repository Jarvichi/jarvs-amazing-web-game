import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MinigameCard } from './MinigameCard';

const meta = {
  component: MinigameCard,
} satisfies Meta<typeof MinigameCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playable: Story = {
  args: {
    icon: '🎯',
    name: 'MARBLE RUN',
    description: 'Guide the marble to the finish line.',
    cost: 20,
    locked: false,
    best: 340,
    challengeDone: false,
    challengeTarget: 400,
    challengeBonusTickets: 25,
    onPlay: fn(),
  },
};

export const Locked: Story = {
  args: {
    ...Playable.args,
    locked: true,
  },
};

export const ChallengeComplete: Story = {
  args: {
    ...Playable.args,
    challengeDone: true,
  },
};

export const NoBestScoreYet: Story = {
  args: {
    ...Playable.args,
    best: 0,
  },
};
