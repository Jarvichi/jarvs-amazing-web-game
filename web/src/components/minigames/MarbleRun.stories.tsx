import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MarbleRun } from './MarbleRun';

const meta = {
  component: MarbleRun,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MarbleRun>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
