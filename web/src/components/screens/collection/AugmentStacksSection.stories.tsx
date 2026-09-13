import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentStacksSection } from './AugmentStacksSection';

const instances = (setName: string) => Array.from({ length: 7 }, (_, i) => ({
  instanceId: `${setName}-${i}`,
  cardId: `${setName} Piece ${i}`,
  level: 1,
  equippedToCardName: null,
}));

const meta = {
  component: AugmentStacksSection,
} satisfies Meta<typeof AugmentStacksSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoStacks: Story = {
  args: {
    stacks: [
      { setName: 'Thunder Warden', setDef: { name: 'Thunder Warden', rarity: 'rare', bonuses: [] } as never, instances: instances('tw') },
      { setName: 'Verdant Guard', setDef: { name: 'Verdant Guard', rarity: 'epic', bonuses: [] } as never, instances: instances('vg') },
    ],
    souls: 500,
    upgradeCost: 100,
    stackErrors: {},
    onView: fn(),
    onUpgrade: fn(),
    onEquipToUnit: fn(),
  },
};

export const Empty: Story = {
  args: {
    ...TwoStacks.args,
    stacks: [],
  },
};
