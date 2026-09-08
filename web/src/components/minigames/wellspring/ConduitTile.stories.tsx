import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConduitTile } from './ConduitTile';

// Masks are bit flags; leakDirs are direction indices. Keeping both named
// separately so a story can't quietly pass one where the other is meant.
const N = 1, E = 2, S = 4, W = 8;
const DIR_EAST = 1;

const meta = {
  component: ConduitTile,
  parameters: { layout: 'centered' },
  args: {
    mask: N | E,
    role: 'pipe' as const,
    fixed: false,
    seized: false,
    filled: false,
    rotatable: true,
    row: 1,
    col: 2,
  },
  decorators: [
    Story => (
      <div style={{ width: 96, height: 96, display: 'grid' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConduitTile>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Dry stone — the piece carries no water yet. */
export const Dry: Story = {};

/** Lit and flowing: the payoff state the whole board animates toward. */
export const Carrying: Story = { args: { filled: true } };

/** An open end with water behind it sprays. This is the fail-signal that
 *  teaches the rules without a line of UI text. */
export const Leaking: Story = { args: { filled: true, leakDirs: [DIR_EAST] } };

export const Straight: Story = { args: { mask: N | S, filled: true } };
export const Tee: Story      = { args: { mask: N | E | S, filled: true } };
export const Cap: Story      = { args: { mask: W, filled: true } };

/** A cross reads the same at every angle, so it is never a move. */
export const Cross: Story = { args: { mask: N | E | S | W, filled: true, rotatable: false } };

/** The spring. Fixed, and the only cell water starts in. */
export const Source: Story = { args: { role: 'source', mask: E, fixed: true, filled: true, rotatable: false } };

export const BasinEmpty: Story = { args: { role: 'basin', mask: W } };
export const BasinFilled: Story = { args: { role: 'basin', mask: W, filled: true } };

/** Beginner scaffold on the shallowest depth: pre-solved and un-rotatable. */
export const Welded: Story = { args: { fixed: true, rotatable: false, filled: true } };

/** Rusted in place on the deepest depth — turns at double cost. */
export const Seized: Story = { args: { seized: true } };
