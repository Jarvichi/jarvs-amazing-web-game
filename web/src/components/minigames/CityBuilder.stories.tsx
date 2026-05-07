import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CityBuilder } from './CityBuilder';

const meta = {
  component: CityBuilder,
} satisfies Meta<typeof CityBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onBack": fn(),
  },
};