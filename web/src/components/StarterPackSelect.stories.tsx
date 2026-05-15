import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StarterPackSelect } from './StarterPackSelect';

const meta = {
  component: StarterPackSelect,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StarterPackSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onPick: fn(),
  },
};

export const WithFatiguedCards: Story = {
  args: {
    onPick: fn(),
    fatiguedCards: ['Goblin', 'Archer'],
  },
};

export const WithBonusCards: Story = {
  args: {
    onPick: fn(),
    bonusCards: ['Dragon', 'Paladin'],
  },
};
