import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BossDialogueScreen } from './BossDialogueScreen';

const meta = {
  component: BossDialogueScreen,
} satisfies Meta<typeof BossDialogueScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "bossName": "bossName",
    "lines": [
      "lines"
    ],
    "onDone": fn()
  },
};