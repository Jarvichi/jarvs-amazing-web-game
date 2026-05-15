import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardRestSelectCandidate } from './CardRestSelectCandidate';

const meta = {
  component: CardRestSelectCandidate,
} satisfies Meta<typeof CardRestSelectCandidate>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Goblin',
    playCount: 7,
    rank: 1,
    isSelected: false,
    onClick: fn(),
  },
};

export const Selected: Story = {
  args: {
    name: 'Archer',
    playCount: 12,
    rank: 2,
    isSelected: true,
    onClick: fn(),
  },
};

export const LowPlays: Story = {
  args: {
    name: 'Dragon',
    playCount: 1,
    rank: 3,
    isSelected: false,
    onClick: fn(),
  },
};
