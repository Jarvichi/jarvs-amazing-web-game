import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConfusedTouristEvent } from './ConfusedTouristEvent';

const meta = {
  component: ConfusedTouristEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConfusedTouristEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
