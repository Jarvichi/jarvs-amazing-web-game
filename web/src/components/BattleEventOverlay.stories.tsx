import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BattleEventOverlay } from './BattleEventOverlay';

const meta = {
  component: BattleEventOverlay,
} satisfies Meta<typeof BattleEventOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "event": fn()
  },
};