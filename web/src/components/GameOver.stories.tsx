import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GameOver } from './GameOver';
import type { GameState } from '../game/types';

const meta = {
  component: GameOver,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GameOver>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseGameState: GameState = {
  playerBase: { hp: 45, maxHp: 100 },
  opponentBase: { hp: 0, maxHp: 100 },
  field: [],
  playerHand: [],
  playerDeck: [],
  opponentHand: [],
  opponentDeck: [],
  mana: 3,
  maxMana: 5,
  manaAccum: 0,
  log: [],
  phase: { type: 'gameOver', winner: 'player' },
  opponentTimer: 0,
  opponentIntervalMs: 3000,
  opponentStrategy: 'balanced',
  gameTime: 95000,
  playerScore: 240,
  opponentScore: 120,
  suddenDeath: false,
  suddenDeathTimer: 0,
  suddenDeathBuildingTimer: 0,
  battleEventTimer: 0,
  activeBattleEvent: null,
  terrain: [],
  battleStats: { cardsPlayed: {}, playerKills: 12, playerUnitsLost: 5 },
  animEvents: [],
  bloodPools: [],
};

export const Victory: Story = {
  args: {
    state: baseGameState,
    winner: 'player',
    handicap: 1,
    onPlayAgain: fn(),
    onMainMenu: fn(),
  },
};

export const Defeat: Story = {
  args: {
    state: {
      ...baseGameState,
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
