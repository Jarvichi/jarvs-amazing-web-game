import type { Meta, StoryObj } from '@storybook/react-vite';

import { Lives } from './Lives';

const meta = {
  component: Lives,
} satisfies Meta<typeof Lives>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: {
    maxLives: 3,
    currentLives: 3,
  },
};

export const OneRemaining: Story = {
  args: {
    maxLives: 3,
    currentLives: 1,
  },
};

export const Empty: Story = {
  args: {
    maxLives: 3,
    currentLives: 0,
  },
};

export const FiveLives: Story = {
  args: {
    maxLives: 5,
    currentLives: 4,
  },
};
