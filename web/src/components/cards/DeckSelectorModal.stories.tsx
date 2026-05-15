import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeckSelectorModal } from './DeckSelectorModal';

const meta = {
  component: DeckSelectorModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DeckSelectorModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const WithFatiguedCards: Story = {
  args: {
    fatiguedCards: ['Goblin', 'Archer', 'Troll'],
    onConfirm: fn(),
    onCancel: fn(),
  },
};
