import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TitleButton } from './TitleButton';

const meta = {
  component: TitleButton,
} satisfies Meta<typeof TitleButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClick: fn(),
    children: 'Battle',
  },
};

export const Large: Story = {
  args: {
    onClick: fn(),
    children: 'Start Campaign',
    variant: 'large',
  },
};

export const WithBadge: Story = {
  args: {
    onClick: fn(),
    children: 'Shop',
    badge: true,
  },
};

export const Disabled: Story = {
  args: {
    onClick: fn(),
    children: 'Locked',
    disabled: true,
  },
};
