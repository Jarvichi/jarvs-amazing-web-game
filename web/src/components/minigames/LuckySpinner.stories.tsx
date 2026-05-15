import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LuckySpinner } from './LuckySpinner';

const meta = {
  component: LuckySpinner,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LuckySpinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
