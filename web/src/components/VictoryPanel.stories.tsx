import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { VictoryPanel } from './VictoryPanel';

const meta = {
  component: VictoryPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VictoryPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    playerScore: 2400,
    opponentScore: 800,
    playerBaseHp: 85,
    playerBaseMaxHp: 100,
    unitsDefeated: 34,
    gameTime: 154000,
    onContinue: fn(),
  },
};

export const CloseGame: Story = {
  args: {
    playerScore: 1200,
    opponentScore: 1150,
    playerBaseHp: 10,
    playerBaseMaxHp: 100,
    unitsDefeated: 18,
    gameTime: 312000,
    onContinue: fn(),
  },
};

export const MaxHp: Story = {
  args: {
    playerScore: 3800,
    opponentScore: 400,
    playerBaseHp: 100,
    playerBaseMaxHp: 100,
    unitsDefeated: 52,
    gameTime: 87000,
    onContinue: fn(),
  },
};
