import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { HigherOrLower } from './HigherOrLower';

const meta = {
  component: HigherOrLower,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HigherOrLower>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
