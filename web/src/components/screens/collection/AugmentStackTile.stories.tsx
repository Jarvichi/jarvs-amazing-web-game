import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentStackTile } from './AugmentStackTile';

const instances = (level: number, equipped: string | null = null) => Array.from({ length: 7 }, (_, i) => ({
  instanceId: `inst-${i}`,
  cardId: `Augment ${i}`,
  level,
  equippedToCardName: i === 0 ? equipped : null,
}));

const meta = {
  component: AugmentStackTile,
} satisfies Meta<typeof AugmentStackTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stack: {
      setName: 'Thunder Warden',
      setDef: { name: 'Thunder Warden', rarity: 'rare', bonuses: [] } as never,
      instances: instances(2),
    },
    souls: 500,
    upgradeCost: 100,
    onView: fn(),
    onUpgrade: fn(),
    onEquipToUnit: fn(),
  },
};

export const NotEnoughSouls: Story = {
  args: {
    ...Default.args,
    souls: 10,
  },
};

export const AlreadyEquipped: Story = {
  args: {
    stack: {
      setName: 'Thunder Warden',
      setDef: { name: 'Thunder Warden', rarity: 'legendary', bonuses: [] } as never,
      instances: instances(3, 'Knight'),
    },
    souls: 500,
    upgradeCost: 100,
    onView: fn(),
    onUpgrade: fn(),
    onEquipToUnit: fn(),
  },
};
