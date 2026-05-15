import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CrystalCatch } from './CrystalCatch';

const meta = {
  component: CrystalCatch,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CrystalCatch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
