import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentItemGrid } from './AugmentItemGrid';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: AugmentItemGrid,
} satisfies Meta<typeof AugmentItemGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      {
        inst: { instanceId: 'inst-1', cardId: 'Thunder Helm', level: 1, equippedToCardName: null },
        displayCard: { ...exampleCard, name: 'Thunder Helm', cardType: 'augment' },
        groupLabel: null,
        breakdownValue: 20,
      },
      {
        inst: { instanceId: 'inst-2', cardId: 'Thunder Greaves', level: 3, equippedToCardName: 'Knight' },
        displayCard: { ...exampleCard, name: 'Thunder Greaves', cardType: 'augment', rarity: 'epic' },
        groupLabel: null,
        breakdownValue: 60,
      },
    ],
    souls: 500,
    upgradeCost: 100,
    onSelect: fn(),
    onViewEquippedUnit: fn(),
    onUpgrade: fn(),
    onBreakdown: fn(),
  },
};

export const Grouped: Story = {
  args: {
    ...Default.args,
    items: Default.args!.items!.map((item, i) => ({ ...item, groupLabel: i === 0 ? 'Helmet' : 'Greaves' })),
  },
};
