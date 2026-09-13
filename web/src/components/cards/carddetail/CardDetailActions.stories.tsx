import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailActions } from './CardDetailActions';

const meta = {
  component: CardDetailActions,
} satisfies Meta<typeof CardDetailActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AugmentUpgrade: Story = {
  args: {
    augmentUpgradeCost: 100,
    canUpgrade: true,
    onUpgrade: fn(),
    breakdownValue: 0,
    extras: 0,
    disenchantValue: 0,
  },
};

export const AugmentBreakdown: Story = {
  args: {
    augmentUpgradeCost: 100,
    breakdownValue: 40,
    onBreakdown: fn(),
    extras: 0,
    disenchantValue: 0,
  },
};

export const CollectionSellAndUpgrade: Story = {
  args: {
    augmentUpgradeCost: 100,
    breakdownValue: 0,
    extras: 4,
    disenchantValue: 12,
    onDisenchant: fn(),
    onMasterCard: fn(),
  },
};
