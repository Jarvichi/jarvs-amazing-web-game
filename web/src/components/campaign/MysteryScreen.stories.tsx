import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MysteryScreen } from './MysteryScreen';
import { exampleRewardDef } from '../../game/types.sample';

const meta = {
  component: MysteryScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MysteryScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Crystals: Story = {
  args: {
    reward: exampleRewardDef,
    onCollect: fn(),
  },
};

export const Card: Story = {
  args: {
    reward: {
      id: 'reward-card',
      name: 'A Rare Card',
      icon: '🃏',
      desc: 'You found a rare card.',
      lore: 'The winds of fate blow in your favour.',
      weight: 1,
      type: 'card',
      cardName: 'Dragon',
    },
    onCollect: fn(),
  },
};

export const Pack: Story = {
  args: {
    reward: {
      id: 'reward-pack',
      name: 'Card Pack',
      icon: '📦',
      desc: 'A pack of 5 cards.',
      lore: 'Sealed with mysterious energy.',
      weight: 1,
      type: 'pack',
      count: 5,
    },
    onCollect: fn(),
  },
};
