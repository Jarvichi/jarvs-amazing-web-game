import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatRow } from './StatRow';

const meta = {
  component: StatRow,
} satisfies Meta<typeof StatRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Attack',
    value: 12,
  },
};

export const Accent: Story = {
  args: {
    label: 'Score',
    value: '1,500',
    accent: true,
  },
};

export const Compact: Story = {
  args: {
    label: 'HP',
    value: '80 / 100',
    compact: true,
  },
};

export const CompactAccent: Story = {
  args: {
    label: 'Time',
    value: '2m 34s',
    compact: true,
    accent: true,
  },
};
