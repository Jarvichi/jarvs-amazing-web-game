import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentSoulsBar } from './AugmentSoulsBar';

const meta = {
  component: AugmentSoulsBar,
} satisfies Meta<typeof AugmentSoulsBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    souls: 500,
  },
};

export const WithError: Story = {
  args: {
    souls: 10,
    upgradeError: 'Not enough souls to upgrade.',
  },
};
