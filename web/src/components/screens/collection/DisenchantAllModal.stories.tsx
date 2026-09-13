import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DisenchantAllModal } from './DisenchantAllModal';

const meta = {
  component: DisenchantAllModal,
} satisfies Meta<typeof DisenchantAllModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { cardName: 'Goblin', crystals: 4 },
      { cardName: 'Archer', crystals: 12 },
      { cardName: 'Dragon', crystals: 200 },
    ],
    onClose: fn(),
  },
};
