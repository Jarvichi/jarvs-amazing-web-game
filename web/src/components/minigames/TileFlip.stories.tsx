import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TileFlip } from './TileFlip';

const meta = {
  component: TileFlip,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TileFlip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
