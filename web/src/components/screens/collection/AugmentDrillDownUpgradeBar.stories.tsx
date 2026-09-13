import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentDrillDownUpgradeBar } from './AugmentDrillDownUpgradeBar';

const instances = Array.from({ length: 7 }, (_, i) => ({
  instanceId: `inst-${i}`,
  cardId: `Augment ${i}`,
  level: 2,
  equippedToCardName: null,
}));

const meta = {
  component: AugmentDrillDownUpgradeBar,
} satisfies Meta<typeof AugmentDrillDownUpgradeBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stack: {
      setName: 'Thunder Warden',
      setDef: { name: 'Thunder Warden', rarity: 'rare', bonuses: [] } as never,
      instances,
    },
    souls: 500,
    upgradeCost: 100,
    onUpgrade: fn(),
  },
};

export const NotEnoughSouls: Story = {
  args: {
    ...Default.args,
    souls: 10,
  },
};
