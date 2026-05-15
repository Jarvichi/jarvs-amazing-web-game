import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { VideoPoker } from './VideoPoker';

const meta = {
  component: VideoPoker,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VideoPoker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
