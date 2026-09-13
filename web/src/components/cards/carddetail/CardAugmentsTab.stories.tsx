import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardAugmentsTab } from './CardAugmentsTab';

const meta = {
  component: CardAugmentsTab,
} satisfies Meta<typeof CardAugmentsTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    souls: 500,
    upgradeCost: 100,
    equippedMap: {
      helmet: { instanceId: 'i-1', cardId: 'Thunder Helm', level: 2, equippedToCardName: 'Knight' },
    },
    setBonus: undefined,
    onUpgrade: fn(),
    onPickSlot: fn(),
  },
};
