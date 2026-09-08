import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stowage } from './Stowage';

const meta = {
  component: Stowage,
  parameters: { layout: 'centered' },
  args: {
    tier: 'handcart',
    onDone: (result) => console.log('[Stowage] packed', result),
  },
} satisfies Meta<typeof Stowage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Handcart — the crate a hamlet gets. Five goods, no packing timber, and the
 * borders of an empty rectangle to anchor against.
 */
export const Handcart: Story = {};

/** Wagon Bed — eight goods and two pieces of timber in the way. */
export const WagonBed: Story = { args: { tier: 'wagon' } };

/**
 * Ship's Hold — nine goods and five pieces of timber. Bigger, but it is the
 * timber rather than the size that makes it hard: the measured median good has
 * fewer legal homes here than on the Wagon Bed (docs/minigame-stowage.md §8).
 */
export const ShipsHold: Story = { args: { tier: 'hold' } };
