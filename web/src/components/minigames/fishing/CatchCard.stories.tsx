import type { Meta, StoryObj } from '@storybook/react-vite';

import { CatchCard } from './CatchCard';

const meta = {
  component: CatchCard,
  parameters: { layout: 'centered' },
  args: {
    result: {
      kind: 'fish', tier: 'Tiddler', tierIcon: '🐟', name: 'Stickleback',
      weightGrams: 320, lengthCm: 14, tickets: 4,
    },
    tierIndex: 0,
    stars: 2,
    reward: '+4 🎫',
  },
} satisfies Meta<typeof CatchCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tiddler: Story = {};

export const Trophy: Story = {
  args: {
    result: {
      kind: 'fish', tier: 'Trophy', tierIcon: '🏆', name: 'River Titan',
      weightGrams: 21400, lengthCm: 138, tickets: 118,
    },
    tierIndex: 4, stars: 4, reward: '+118 🎫',
  },
};

export const Legendary: Story = {
  args: {
    result: {
      kind: 'fish', tier: 'Legendary', tierIcon: '✨', name: 'Ancient Sturgeon',
      weightGrams: 49500, lengthCm: 196, tickets: 240,
    },
    tierIndex: 5, stars: 5, reward: '✨ Added to inventory!',
  },
};

export const SpecialItem: Story = {
  args: {
    result: { kind: 'item', id: 'old-boot', name: 'Rusted Lantern', icon: '🏮', desc: 'Waterlogged, but the glass is intact.' },
    reward: '+5 🎫  ·  Added to inventory!',
  },
};

export const CardFind: Story = {
  args: {
    result: { kind: 'card', name: 'Tidecaller', rarity: 'epic' },
    reward: '+10 🎫  ·  Added to collection!',
  },
};
