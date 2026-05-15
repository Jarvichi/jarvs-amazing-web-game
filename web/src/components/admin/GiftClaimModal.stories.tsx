import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GiftClaimModal } from './GiftClaimModal';
import type { GiftDef } from '../../game/gifts';

const meta = {
  component: GiftClaimModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GiftClaimModal>;

export default meta;

type Story = StoryObj<typeof meta>;

const exampleGifts: GiftDef[] = [
  {
    id: 'gift_launch_bonus',
    name: 'Launch Bonus',
    description: 'A special gift to celebrate the launch!',
    createdAt: '2026-04-01',
    rewards: [
      { type: 'crystals', amount: 200 },
      { type: 'pack', count: 3 },
    ],
  },
];

export const Default: Story = {
  args: {
    gifts: exampleGifts,
    onClaim: fn(),
  },
};
