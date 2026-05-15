import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LiarsDiceEvent } from './LiarsDiceEvent';

const meta = {
  component: LiarsDiceEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LiarsDiceEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
