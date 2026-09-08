import type { Meta, StoryObj } from '@storybook/react-vite';

import { StowStatusBar } from './StowStatusBar';

const meta = {
  component: StowStatusBar,
  parameters: { layout: 'centered' },
  args: { stowed: 0, total: 8, open: 34, packed: false },
} satisfies Meta<typeof StowStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A fresh Wagon Bed: nothing in yet. */
export const Fresh: Story = {};

/** Partway. The open-slot count is the honest measure — seven goods of eight
 *  in with four slots showing is not nearly finished, and a "7/8" alone would
 *  say it was. */
export const MidStow: Story = { args: { stowed: 5, open: 13 } };

/** The last good, and the trap the counter exists for. */
export const OneLeft: Story = { args: { stowed: 7, open: 4 } };

/** Packed square. */
export const Packed: Story = { args: { stowed: 8, open: 0, packed: true } };
