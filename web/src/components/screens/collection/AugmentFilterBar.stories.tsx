import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentFilterBar } from './AugmentFilterBar';

const meta = {
  component: AugmentFilterBar,
} satisfies Meta<typeof AugmentFilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    sortKey: 'default',
    groupKey: 'none',
    openMenu: null,
    onOpenMenuChange: fn(),
    onSortChange: fn(),
    onGroupChange: fn(),
  },
};

export const SortOpen: Story = {
  args: {
    ...Default.args,
    sortKey: 'rarity',
    openMenu: 'sort',
  },
};
