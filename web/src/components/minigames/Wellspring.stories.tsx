import type { Meta, StoryObj } from '@storybook/react-vite';

import { Wellspring } from './Wellspring';

const meta = {
  component: Wellspring,
  parameters: { layout: 'fullscreen' },
  args: { onDone: () => {} },
} satisfies Meta<typeof Wellspring>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Arcade mode: the player picks a depth and the board pays tickets. */
export const Arcade: Story = {};

export const ArcadeShallow: Story = { args: { depth: 'shallow' } };
export const ArcadeAbyssal: Story = { args: { depth: 'vault' } };

/** Hub-world mode at a town well: no depth picker (the well's depth is
 *  authored per town) and the payout is crystals and water, not tickets. */
export const HubRestoration: Story = {
  args: { rewardMode: 'restore', depth: 'deep' },
};
