import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from './ProgressBar';

const meta = {
  component: ProgressBar,
  title: 'UI/ProgressBar',
  parameters: { layout: 'centered' },  
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pct: 60,
  },
};

export const Full: Story = {
  args: {
    pct: 100,
  },
};

export const Empty: Story = {
  args: {
    pct: 0,
  },
};

export const Red: Story = {
  args: {
    pct: 30,
    color: '#e74c3c',
  },
};

export const GoldGradient: Story = {
  args: {
    pct: 75,
    color: 'linear-gradient(90deg, #b8860b, #ffd700)',
  },
};
