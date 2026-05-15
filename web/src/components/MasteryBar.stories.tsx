import type { Meta, StoryObj } from '@storybook/react-vite';

import { MasteryBar } from './MasteryBar';

const meta = {
  component: MasteryBar,
} satisfies Meta<typeof MasteryBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    xp: 0,
  },
};

export const MidLevel: Story = {
  args: {
    xp: 50,
  },
};

export const HighLevel: Story = {
  args: {
    xp: 500,
  },
};

export const AlmostLevelUp: Story = {
  args: {
    xp: 99,
  },
};
