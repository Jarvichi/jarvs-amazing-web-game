import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SavedDecksModal } from './SavedDecksModal';

const meta = {
  component: SavedDecksModal,
} satisfies Meta<typeof SavedDecksModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    savedDecks: [],
    saveNameInput: '',
    onSaveNameChange: fn(),
    onSave: fn(),
    onLoad: fn(),
    onDelete: fn(),
    onClose: fn(),
  },
};

export const WithSavedDecks: Story = {
  args: {
    savedDecks: [
      { name: 'Aggro Rush', deck: [{ cardName: 'Goblin', count: 4 }, { cardName: 'Archer', count: 4 }], savedAt: Date.now() },
      { name: 'Control', deck: [{ cardName: 'Stone Wall', count: 2 }], savedAt: Date.now() },
    ],
    saveNameInput: 'New Deck',
    onSaveNameChange: fn(),
    onSave: fn(),
    onLoad: fn(),
    onDelete: fn(),
    onClose: fn(),
  },
};
