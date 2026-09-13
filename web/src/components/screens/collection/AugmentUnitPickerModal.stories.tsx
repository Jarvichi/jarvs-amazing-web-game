import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentUnitPickerModal } from './AugmentUnitPickerModal';

const meta = {
  component: AugmentUnitPickerModal,
} satisfies Meta<typeof AugmentUnitPickerModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stack: {
      setName: 'Thunder Warden',
      setDef: { name: 'Thunder Warden', rarity: 'rare', bonuses: [] } as never,
      instances: [],
    },
    onEquip: fn(),
    onClose: fn(),
  },
};
