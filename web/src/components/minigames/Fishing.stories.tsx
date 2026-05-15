import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Fishing } from './Fishing';

const meta = {
  component: Fishing,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Fishing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
