import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GameOver } from './GameOver';
import type { GameState } from '../../game/types';
import { exampleGameState } from '../../game/types.sample';

const meta = {
  component: GameOver,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GameOver>;

export default meta;

type Story = StoryObj<typeof meta>;


export const Victory: Story = {
  args: {
    state: exampleGameState,
    winner: 'player',
    handicap: 1,
    onPlayAgain: fn(),
    onMainMenu: fn(),
  },
};

export const Defeat: Story = {
  args: {
    state: {
      ...exampleGameState,
      playerBase: { hp: 0, maxHp: 100 },
      opponentBase: { hp: 30, maxHp: 100 },
      phase: { type: 'gameOver', winner: 'opponent' },
      playerScore: 80,
      opponentScore: 200,
    },
    winner: 'opponent',
    handicap: 0,
    onPlayAgain: fn(),
    onMainMenu: fn(),
  },
};
