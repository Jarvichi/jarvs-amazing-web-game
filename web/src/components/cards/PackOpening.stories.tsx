import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PackOpening } from './PackOpening';

const meta = {
  component: PackOpening,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PackOpening>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SinglePack: Story = {
  args: {
    packs: [['Goblin', 'Archer', 'Troll', 'Dragon', 'Paladin']],
    onDone: fn(),
  },
};

export const MultiplePacks: Story = {
  args: {
    packs: [
      ['Goblin', 'Archer', 'Troll', 'Dragon', 'Paladin'],
      ['Rogue', 'Golem', 'Vampire', 'Griffin', 'Scorpion'],
    ],
    onDone: fn(),
  },
};
