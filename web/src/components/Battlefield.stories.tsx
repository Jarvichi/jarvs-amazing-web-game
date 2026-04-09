import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Battlefield } from './Battlefield';
import { exampleGameState } from "../game/types.sample";

const meta = {
  component: Battlefield,
} satisfies Meta<typeof Battlefield>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "state": exampleGameState,
    "onPlayCard": fn(),

  },
};