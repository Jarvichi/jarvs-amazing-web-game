import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugStatRow } from './AugStatRow';

const meta = {
  component: AugStatRow,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AugStatRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BaseOnly: Story = {
  args: {
    label: 'ATK',
    base: 5,
  },
};

export const WithBonuses: Story = {
  args: {
    label: 'ATK',
    base: 5,
    mastery: 3,
    augment: 2,
  },
};

export const WithBreakdown: Story = {
  args: {
    ...WithBonuses.args,
    breakdown: true,
  },
};
