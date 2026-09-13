import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeckPanel } from './DeckPanel';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: DeckPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DeckPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithCards: Story = {
  args: {
    collapsed: false,
    onToggleCollapse: fn(),
    activeSlot: 'a',
    onSwitchSlot: fn(),
    onOpenAutoBuild: fn(),
    onOpenSavedDecks: fn(),
    onOpenShare: fn(),
    total: 12,
    playerDeckMax: 30,
    deckLength: 3,
    search: '',
    items: [
      { card: exampleCard, count: 4, resting: false, xp: 0, level: 0, comboCount: 0 },
      { card: { ...exampleCard, name: 'Archer', rarity: 'rare' }, count: 2, resting: true, xp: 40, level: 2, comboCount: 1 },
    ],
    onRemove: fn(),
    onInfo: fn(),
  },
};

export const Empty: Story = {
  args: {
    ...WithCards.args,
    total: 0,
    deckLength: 0,
    items: [],
  },
};

export const Collapsed: Story = {
  args: {
    ...WithCards.args,
    collapsed: true,
  },
};
