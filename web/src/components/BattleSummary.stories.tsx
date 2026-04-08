import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BattleSummary } from './BattleSummary';

const meta = {
  component: BattleSummary,
} satisfies Meta<typeof BattleSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "stats": null,
    "gameTime": 0,
    "playerScore": 0,
    "onContinue": fn()
  },
};