import type { Meta, StoryObj } from '@storybook/react-vite';

import { LedScroller } from './LedScroller';

const meta = {
  component: LedScroller,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LedScroller>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: 'Hello, World!',
  },
};
