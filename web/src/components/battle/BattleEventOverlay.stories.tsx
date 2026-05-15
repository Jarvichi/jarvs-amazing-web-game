import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BattleEventOverlay } from './BattleEventOverlay';
import { exampleBattleEventState } from "../../game/types.sample";

const meta = {
  component: BattleEventOverlay,
} satisfies Meta<typeof BattleEventOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "event": exampleBattleEventState
  },
};