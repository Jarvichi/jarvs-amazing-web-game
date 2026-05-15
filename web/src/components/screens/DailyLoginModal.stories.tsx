import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DailyLoginModal } from './DailyLoginModal';
import type { RewardDef } from '../../game/dailyLogin';

const meta = {
  component: DailyLoginModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DailyLoginModal>;

export default meta;

type Story = StoryObj<typeof meta>;

const crystalReward: RewardDef = {
  id: 'daily-crystals',
  name: 'Crystals',
  icon: '💎',
  desc: 'A handful of crystals.',
  lore: '',
  weight: 10,
  type: 'crystals',
  amount: 50,
};

export const Default: Story = {
  args: {
    reward: crystalReward,
    onClose: fn(),
  },
};

const packReward: RewardDef = {
  id: 'daily-pack',
  name: 'Card Pack',
  icon: '🎁',
  desc: 'A bundle of cards.',
  lore: '',
  weight: 5,
  type: 'pack',
  count: 5,
};

export const PackReward: Story = {
  args: {
    reward: packReward,
    onClose: fn(),
  },
};
