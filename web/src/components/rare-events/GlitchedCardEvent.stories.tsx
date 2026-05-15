import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GlitchedCardEvent } from './GlitchedCardEvent';

const meta = {
  component: GlitchedCardEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GlitchedCardEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
