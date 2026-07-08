import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { HarbourRegatta } from './HarbourRegatta';

const meta = {
  component: HarbourRegatta,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HarbourRegatta>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
