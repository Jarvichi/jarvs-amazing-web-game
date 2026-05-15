import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MarbleRace } from './MarbleRace';

const meta = {
  component: MarbleRace,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MarbleRace>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
