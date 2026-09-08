import type { Meta, StoryObj } from '@storybook/react-vite';

import { GoodsTray } from './GoodsTray';
import { getTier, generateBoard, type Rng } from '../Stowage.logic';

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const handcart = generateBoard(getTier('handcart'), seeded(7));
const hold = generateBoard(getTier('hold'), seeded(3));

const meta = {
  component: GoodsTray,
  parameters: { layout: 'centered' },
  args: { goods: handcart.goods },
} satisfies Meta<typeof GoodsTray>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A Handcart's five goods, each in the hue it will wear once stowed. */
export const Handcart: Story = {};

/** A Ship's Hold: nine goods, the widest the tray gets before it wraps to a
 *  third row on a phone. */
export const ShipsHold: Story = { args: { goods: hold.goods } };

/** One good held. The gold border marks it, and the dark pip marks its
 *  anchor — the slot a tap on the crate lands on. */
export const Selected: Story = { args: { goods: handcart.goods, selectedId: handcart.goods[1].id } };

/** Down to the last two, which is where a player is usually deciding between
 *  two awkward shapes rather than scanning. */
export const NearlyEmpty: Story = { args: { goods: handcart.goods.slice(0, 2) } };

/** Nothing left to stow. */
export const Empty: Story = { args: { goods: [] } };
