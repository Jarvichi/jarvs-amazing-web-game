import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DevMenu } from './DevMenu';

const meta = {
  component: DevMenu,
} satisfies Meta<typeof DevMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onCrystalsChanged: fn(),
    onHandicapChanged: fn(),
  },
};
