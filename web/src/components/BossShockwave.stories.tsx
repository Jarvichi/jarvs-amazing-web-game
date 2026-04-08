import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import BossShockwave from './BossShockwave';

const meta = {
  component: BossShockwave,
} satisfies Meta<typeof BossShockwave>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onDone": fn()
  },
};