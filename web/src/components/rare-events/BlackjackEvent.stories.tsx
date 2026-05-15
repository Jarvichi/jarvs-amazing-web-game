import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BlackjackEvent } from './BlackjackEvent';

const meta = {
  component: BlackjackEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BlackjackEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
