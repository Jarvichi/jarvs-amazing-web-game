import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FruitMachine } from './FruitMachine';

const meta = {
  component: FruitMachine,
} satisfies Meta<typeof FruitMachine>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onDone": fn(),
  },
};