import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DevBuildEvent } from './DevBuildEvent';

const meta = {
  component: DevBuildEvent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DevBuildEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
