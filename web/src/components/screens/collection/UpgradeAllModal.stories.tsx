import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { UpgradeAllModal } from './UpgradeAllModal';

const meta = {
  component: UpgradeAllModal,
} satisfies Meta<typeof UpgradeAllModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { cardName: 'Goblin', xpGained: 2 },
      { cardName: 'Archer', xpGained: 4 },
    ],
    onClose: fn(),
  },
};
