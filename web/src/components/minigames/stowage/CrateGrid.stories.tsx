import type { Meta, StoryObj } from '@storybook/react-vite';

import { CrateGrid } from './CrateGrid';
import {
  getTier, generateBoard, stow, goodCells, anchorOf, type Board, type Rng,
} from '../Stowage.logic';

/** Fixed seed so a story renders the same crate every time it is opened. */
function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const handcart = generateBoard(getTier('handcart'), seeded(7));
const wagon = generateBoard(getTier('wagon'), seeded(11));
const hold = generateBoard(getTier('hold'), seeded(3));

/** Stow the first `n` goods where the manifest says they go. */
function packed(board: Board, n = board.goods.length): Board {
  let next = board;
  for (const good of board.goods.slice(0, n)) {
    next = { ...next, goods: next.goods.map(g => (g.id === good.id ? { ...g, turn: 0 } : g)) };
    const anchor = anchorOf(goodCells(next.goods.find(g => g.id === good.id)!));
    next = stow(next, good.id, good.home.x + anchor.x, good.home.y + anchor.y);
  }
  return next;
}

const midStow = packed(wagon, 5);
const full = packed(wagon);

const meta = {
  component: CrateGrid,
  parameters: { layout: 'centered' },
  args: { board: handcart },
} satisfies Meta<typeof CrateGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Handcart: 5×5, no packing timber. The gentlest crate in the game. */
export const Handcart: Story = {};

/** Wagon Bed: 6×6 with two pieces of timber wedged in. */
export const WagonBed: Story = { args: { board: wagon } };

/** Ship's Hold: 6×7 and five pieces of timber — the dial that actually
 *  makes a crate hard, since every one of them costs an anchor. */
export const ShipsHold: Story = { args: { board: hold } };

/** Partway through: five goods in, and each reads as one object because a
 *  filled slot only draws its border where the neighbour is a different good. */
export const MidStow: Story = { args: { board: midStow } };

/** The ghost of a held good over a slot it fits. */
export const GhostValid: Story = {
  args: { board: midStow, held: midStow.goods[6], hovered: { x: 0, y: 4 } },
};

/** The same ghost where it does not fit — refused taps say why before they are
 *  spent, which is the whole reason the invalid state is drawn at all. */
export const GhostBlocked: Story = {
  args: { board: midStow, held: midStow.goods[6], hovered: { x: 1, y: 0 } },
};

/** Packed square: every free slot covered, nothing left over. */
export const Packed: Story = { args: { board: full, packed: true } };
