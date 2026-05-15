import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NarratorEvent } from './NarratorEvent';

const meta = {
  component: NarratorEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NarratorEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
