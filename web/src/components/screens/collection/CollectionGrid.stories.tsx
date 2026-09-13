import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionGrid } from './CollectionGrid';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: CollectionGrid,
} satisfies Meta<typeof CollectionGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { card: exampleCard, owned: 4, extras: 0, xp: 0, level: 0, groupLabel: null, earnViaQuest: false, levelingUp: false },
      { card: { ...exampleCard, name: 'Archer', rarity: 'rare' }, owned: 6, extras: 2, xp: 40, level: 2, groupLabel: null, earnViaQuest: false, levelingUp: true },
      { card: { ...exampleCard, name: 'Dragon', rarity: 'legendary' }, owned: 0, extras: 0, xp: 0, level: 0, groupLabel: null, earnViaQuest: true, levelingUp: false },
    ],
    onCardClick: fn(),
  },
};

export const Grouped: Story = {
  args: {
    items: [
      { card: exampleCard, owned: 4, extras: 0, xp: 0, level: 0, groupLabel: 'Units', earnViaQuest: false, levelingUp: false },
      { card: { ...exampleCard, name: 'Stone Wall', cardType: 'structure' }, owned: 2, extras: 0, xp: 0, level: 0, groupLabel: 'Structures', earnViaQuest: false, levelingUp: false },
    ],
    onCardClick: fn(),
  },
};
