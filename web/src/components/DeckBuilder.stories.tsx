import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeckBuilder } from './DeckBuilder';

const meta = {
  component: DeckBuilder,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DeckBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};

export const WithFatiguedCards: Story = {
  args: {
    onBack: fn(),
    fatiguedCards: ['Goblin', 'Archer'],
  },
};
