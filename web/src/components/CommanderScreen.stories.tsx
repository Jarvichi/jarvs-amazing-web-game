import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CommanderScreen } from './CommanderScreen';
import type { CommanderState } from '../game/commander';

const meta = {
  component: CommanderScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CommanderScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const exampleCommander: CommanderState = {
  cardName: 'Goblin',
  promotedAt: Date.now() - 1000 * 60 * 60,
  petActions: {},
};

export const Default: Story = {
  args: {
    commander: exampleCommander,
    onBack: fn(),
    onRewardXp: fn(),
    onRewardCrystals: fn(),
    onRewardCard: fn(),
    onRewardPack: fn(),
    onCommanderChanged: fn(),
  },
};
