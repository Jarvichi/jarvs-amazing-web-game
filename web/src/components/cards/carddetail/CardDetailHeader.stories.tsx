import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailHeader } from './CardDetailHeader';
import { exampleCard } from '../../../game/types.sample';
import { RARITY_COLOR } from '../../../theme';

const meta = {
  component: CardDetailHeader,
} satisfies Meta<typeof CardDetailHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: exampleCard,
    collection: [],
    colour: RARITY_COLOR[exampleCard.rarity],
    onClose: fn(),
  },
};

export const WithMastery: Story = {
  args: {
    card: exampleCard,
    collection: [{ cardName: exampleCard.name, count: 4, masteryXp: 155 }],
    colour: RARITY_COLOR[exampleCard.rarity],
    onClose: fn(),
  },
};

export const Legendary: Story = {
  args: {
    card: { ...exampleCard, rarity: 'legendary' },
    collection: [],
    colour: RARITY_COLOR.legendary,
    onClose: fn(),
  },
};
