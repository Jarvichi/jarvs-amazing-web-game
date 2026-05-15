import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CampScreen } from './CampScreen';

const meta = {
  component: CampScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CampScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    playerHp: 35,
    maxHp: 50,
    livesRemaining: 2,
    maxLives: 3,
    fatiguedCards: ['Goblin', 'Archer'],
    healAmount: 15,
    onChoose: fn(),
    result: null,
    onContinue: fn(),
  },
};

export const FullHp: Story = {
  args: {
    playerHp: 50,
    maxHp: 50,
    livesRemaining: 3,
    maxLives: 3,
    fatiguedCards: [],
    healAmount: 15,
    onChoose: fn(),
    result: null,
    onContinue: fn(),
  },
};

export const WithResult: Story = {
  args: {
    playerHp: 50,
    maxHp: 50,
    livesRemaining: 2,
    maxLives: 3,
    fatiguedCards: ['Dragon'],
    healAmount: 15,
    onChoose: fn(),
    result: 'You rest and recover 15 HP.',
    onContinue: fn(),
  },
};
