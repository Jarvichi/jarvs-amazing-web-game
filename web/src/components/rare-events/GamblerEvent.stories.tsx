import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GamblerEvent } from './GamblerEvent';

const meta = {
  component: GamblerEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GamblerEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
