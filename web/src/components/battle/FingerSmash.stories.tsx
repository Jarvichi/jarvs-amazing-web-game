import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import FingerSmash from './FingerSmash';

const meta = {
  component: FingerSmash,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FingerSmash>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    smashedNames: ['Goblin', 'Archer', 'Skeleton'],
    onDone: fn(),
  },
};

export const NoNames: Story = {
  args: {
    smashedNames: [],
    onDone: fn(),
  },
};
