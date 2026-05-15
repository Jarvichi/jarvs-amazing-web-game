import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PostBattleReward } from './PostBattleReward';
import { exampleBattleStats } from '../game/types.sample';

const meta = {
  component: PostBattleReward,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PostBattleReward>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Battle: Story = {
  args: {
    choices: ['Goblin', 'Archer', 'Troll'],
    nodeType: 'battle',
    crystals: 15,
    onPick: fn(),
    onSkip: fn(),
  },
};

export const Elite: Story = {
  args: {
    choices: ['Dragon', 'Paladin', 'Golem'],
    nodeType: 'elite',
    crystals: 30,
    onPick: fn(),
    onSkip: fn(),
  },
};

export const Boss: Story = {
  args: {
    choices: ['Vampire', 'Griffin', 'Executioner'],
    nodeType: 'boss',
    crystals: 50,
    onPick: fn(),
    onSkip: fn(),
  },
};

export const WithBattleSummary: Story = {
  args: {
    choices: ['Goblin', 'Archer', 'Dragon'],
    nodeType: 'battle',
    crystals: 15,
    onPick: fn(),
    onSkip: fn(),
    battleSummary: {
      stats: exampleBattleStats,
      gameTime: 95000,
      playerScore: 1850,
    },
  },
};
