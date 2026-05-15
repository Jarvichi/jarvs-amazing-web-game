import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ActComplete } from './ActComplete';

const meta = {
  component: ActComplete,
} satisfies Meta<typeof ActComplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "actTitle": "actTitle",
    "actSubtitle": "actSubtitle",
    "relicName": "relicName",
    "relicDesc": "relicDesc",
    "onContinue": fn()
  },
};