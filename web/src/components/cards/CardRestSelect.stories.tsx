import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardRestSelect } from './CardRestSelect';

const meta = {
  component: CardRestSelect,
} satisfies Meta<typeof CardRestSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "candidates": [
      "Goblin",
      "Knight",
      "Archer"
    ],
    "playCounts": {
      "Goblin": 10,
      "Knight": 8,
      "Archer": 5,
    },
    "alreadyResting": [
      "Spear Thrower", "Giant"
    ],
    "onConfirm": fn()
  },
};