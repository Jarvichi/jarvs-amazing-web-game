import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardLorePanel } from './CardLorePanel';

const meta = {
  component: CardLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CardLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  args: {
    card: {
      name: 'Ember Wisp',
      rarity: 'rare',
      cardType: 'unit',
      description: 'A flickering spirit of embers. Deals 3 damage on entry.',
      lore: 'It remembers every hearth it was ever born from.',
      unlocked: true,
    },
  },
};

export const Legendary: Story = {
  args: {
    card: {
      name: 'Dominion Shard',
      rarity: 'legendary',
      cardType: 'upgrade',
      description: 'A fragment of the shattered Dominion, humming with power.',
      lore: '',
      unlocked: true,
    },
  },
};

export const Locked: Story = {
  args: {
    card: {
      name: 'Ember Wisp',
      rarity: 'rare',
      cardType: 'unit',
      description: '',
      lore: '',
      unlocked: false,
    },
  },
};
