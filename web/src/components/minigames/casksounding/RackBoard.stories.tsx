import type { Meta, StoryObj } from '@storybook/react-vite';

import { RackBoard } from './RackBoard';
import {
  getTier, generateBoard, strike, chalk, referencePlay, type Rng,
} from '../CaskSounding.logic';

/** Fixed seed so a story renders the same rack every time it is opened. */
function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const taproom = generateBoard(getTier('taproom'), seeded(4));
const cellar = generateBoard(getTier('cellar'), seeded(11));
const vault = generateBoard(getTier('vault'), seeded(6));

/** A rack partway through: the reference solver's own opening strikes played. */
const midSolve = referencePlay(cellar)
  .slice(0, 4)
  .reduce((b, i) => strike(b, i), cellar);

/** The same rack finished, every soured cask named. */
const sorted = cellar.casks.reduce(
  (b, c, i) => (c.soured ? chalk(b, i).board : b),
  cellar,
);

const meta = {
  component: RackBoard,
  parameters: { layout: 'centered' },
  args: { board: taproom, mode: 'sound' as const },
} satisfies Meta<typeof RackBoard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tap Room: 5×5, every row counted. The gentlest rack in the game. */
export const TapRoom: Story = {};

/** Cellar: 6×6, every row counted. */
export const Cellar: Story = { args: { board: cellar } };

/**
 * Vintner's Vault: gaps break the neighbourhood, and four of six rows carry no
 * count at all — the "?" is deliberately not a blank, since a blank would read
 * as zero, which is a strong deduction rather than the absence of one.
 */
export const VintnersVault: Story = { args: { board: vault } };

/** Partway through, with readings on the board to reason from. */
export const MidSolve: Story = { args: { board: midSolve } };

/** Chalk mode — the same rack, a different verb on every tap. */
export const ChalkMode: Story = { args: { board: midSolve, mode: 'chalk' } };

/** Finished: every soured cask named, most of the rack never touched. */
export const Sorted: Story = { args: { board: sorted } };
