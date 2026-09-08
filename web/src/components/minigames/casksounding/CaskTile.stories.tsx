import type { Meta, StoryObj } from '@storybook/react-vite';

import { CaskTile } from './CaskTile';

const meta = {
  component: CaskTile,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div style={{ width: 72, display: 'grid' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    state: 'unknown' as const,
    gap: false,
    reading: null,
    row: 2,
    col: 3,
    rowCount: 2,
    mode: 'sound' as const,
  },
} satisfies Meta<typeof CaskTile>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Untouched — the only state that is tappable. */
export const Unresolved: Story = {};

/** In chalk mode the same cask offers a different verb to a screen reader. */
export const UnresolvedChalkMode: Story = { args: { mode: 'chalk' } };

/** Struck and sound: the cask recedes and its reading is what the eye lands on. */
export const RungQuiet: Story = { args: { state: 'rung', reading: 0 } };
export const RungTwo: Story = { args: { state: 'rung', reading: 2 } };
export const RungLoud: Story = { args: { state: 'rung', reading: 5 } };

/** Struck and bad — identified the expensive way, but identified. */
export const StruckSoured: Story = { args: { state: 'soured' } };

/** Named by the player, for nothing. */
export const Chalked: Story = { args: { state: 'chalked' } };

/** A chalk that rubbed off: the cask was sound and it cost three soundings. */
export const ChalkRubbedOff: Story = {
  args: { state: 'rung', reading: 1, justWrong: true },
};

/** An empty rack slot. Holds its place in the grid but is not a cask. */
export const Gap: Story = { args: { gap: true } };

/** A cask in a row the ledger never counted. */
export const InUncountedRow: Story = { args: { rowCount: null } };
