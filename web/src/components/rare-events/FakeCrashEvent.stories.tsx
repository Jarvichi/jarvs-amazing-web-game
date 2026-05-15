import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FakeCrashEvent } from './FakeCrashEvent';

const meta = {
  component: FakeCrashEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FakeCrashEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
