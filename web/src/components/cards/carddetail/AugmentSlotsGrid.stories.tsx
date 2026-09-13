import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentSlotsGrid } from './AugmentSlotsGrid';

const meta = {
  component: AugmentSlotsGrid,
} satisfies Meta<typeof AugmentSlotsGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneFilled: Story = {
  args: {
    equippedMap: {
      helmet: { instanceId: 'inst-1', cardId: 'Thunder Helm', level: 2, equippedToCardName: 'Knight' },
    },
    souls: 500,
    upgradeCost: 100,
    onUpgrade: fn(),
    onPickSlot: fn(),
  },
};

export const Empty: Story = {
  args: {
    ...OneFilled.args,
    equippedMap: {},
  },
};
