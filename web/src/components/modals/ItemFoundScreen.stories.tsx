import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ItemFoundScreen } from './ItemFoundScreen';
import { exampleUselessItem } from '../../game/types.sample';

const meta = {
  component: ItemFoundScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ItemFoundScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    item: exampleUselessItem,
    onCollect: fn(),
  },
};

export const AnotherItem: Story = {
  args: {
    item: {
      id: 'mystery_pebble',
      name: 'Mystery Pebble',
      icon: '🪨',
      desc: 'Just a pebble.',
      lore: 'You found this on the ground. Why did you pick it up?',
      acquiredDate: '2026-05-15',
    },
    onCollect: fn(),
  },
};
