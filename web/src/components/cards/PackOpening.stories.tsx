import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PackOpening } from './PackOpening';

const meta = {
  component: PackOpening,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PackOpening>;

export default meta;

type Story = StoryObj<typeof meta>;

// A real pack is six cards — generatePack() returns five plus one augment —
// so the screen always lays out as two full rows of three. The stories used to
// pass five, which left the second row half-empty and hid a row-overlap bug.
export const SinglePack: Story = {
  args: {
    packs: [['Undertow Charm', 'Wave Brawler', 'Verdant Bracers', 'Frost Turret', 'Sniper Post', 'Ram Barracks']],
    onDone: fn(),
  },
};

export const MultiplePacks: Story = {
  args: {
    packs: [
      ['Undertow Charm', 'Wave Brawler', 'Verdant Bracers', 'Frost Turret', 'Sniper Post', 'Ram Barracks'],
      ['Goblin', 'Archer', 'Troll', 'Rogue', 'Golem', 'Griffin'],
    ],
    onDone: fn(),
  },
};
