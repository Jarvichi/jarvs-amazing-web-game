import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WrongNumberEvent } from './WrongNumberEvent';

const meta = {
  component: WrongNumberEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WrongNumberEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
