import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConduitBoard } from './ConduitBoard';
import { hashStr, makeSeededRng } from '../../../game/seededRandom';
import {
  generateBoard, computeFlow, getDepth, isRotatable, type Board,
} from '../Wellspring.logic';

// Seeded so every story renders the same board every time — a story that
// reshuffles itself is useless as a visual reference.
function boardFor(depthId: string, seed: string): Board {
  return generateBoard(getDepth(depthId), makeSeededRng(hashStr(seed)));
}

function solved(board: Board): Board {
  return { ...board, cells: board.cells.map(c => ({ ...c, mask: c.solution })) };
}

/** A board most of the way home: every piece right bar a couple. */
function nearlySolved(board: Board, leaveWrong: number): Board {
  const done = solved(board);
  const cells = done.cells.slice();
  let left = leaveWrong;
  for (let i = 0; i < cells.length && left > 0; i++) {
    if (!isRotatable(cells[i]) || cells[i].mask === board.cells[i].mask) continue;
    cells[i] = { ...cells[i], mask: board.cells[i].mask };
    left--;
  }
  return { ...done, cells };
}

const scrambled = boardFor('deep', 'story:deep');

const meta = {
  component: ConduitBoard,
  parameters: { layout: 'centered' },
  args: { board: scrambled, flow: computeFlow(scrambled) },
  decorators: [
    Story => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConduitBoard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** How a Deep board opens: water only in the spring, ends spilling everywhere. */
export const Scrambled: Story = {};

/** Two pieces from home — the state where the puzzle actually reads. */
export const NearlySolved: Story = (() => {
  const board = nearlySolved(scrambled, 2);
  return { args: { board, flow: computeFlow(board) } };
})();

/** The payoff: every conduit carrying, every basin full, nothing spilling. */
export const Solved: Story = (() => {
  const board = solved(scrambled);
  return { args: { board, flow: computeFlow(board) } };
})();

/** Shallow — a 4×4 path board of caps, elbows and straights, with two welded
 *  cells pre-solved as a beginner scaffold. */
export const Shallow: Story = (() => {
  const board = boardFor('shallow', 'story:shallow');
  return { args: { board, flow: computeFlow(board) } };
})();

/** Abyssal — 6×6, tees and crosses, two seized cells, and edges that wrap, so
 *  pieces legitimately point off the frame and back in the far side. */
export const Abyssal: Story = (() => {
  const board = boardFor('vault', 'story:vault');
  return { args: { board, flow: computeFlow(board) } };
})();
