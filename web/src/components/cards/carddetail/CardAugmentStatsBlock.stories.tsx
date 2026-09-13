import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardAugmentStatsBlock } from './CardAugmentStatsBlock';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: CardAugmentStatsBlock,
} satisfies Meta<typeof CardAugmentStatsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unequipped: Story = {
  args: {
    card: {
      ...exampleCard,
      cardType: 'augment',
      augmentEffect: { maxHp: 20, attack: 3 },
      setName: 'Thunder Warden',
      augmentSlot: 'helmet',
    },
    augmentLevel: 1,
    augmentEquippedTo: null,
  },
};

export const Equipped: Story = {
  args: {
    ...Unequipped.args,
    augmentLevel: 3,
    augmentEquippedTo: 'Knight',
  },
};
