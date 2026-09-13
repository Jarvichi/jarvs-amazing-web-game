import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentDrillDownHeader } from './AugmentDrillDownHeader';

const meta = {
  component: AugmentDrillDownHeader,
} satisfies Meta<typeof AugmentDrillDownHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stack: {
      setName: 'Thunder Warden',
      setDef: { name: 'Thunder Warden', rarity: 'rare', bonuses: [] } as never,
      instances: [],
    },
    onBack: fn(),
    onEquipToUnit: fn(),
  },
};
