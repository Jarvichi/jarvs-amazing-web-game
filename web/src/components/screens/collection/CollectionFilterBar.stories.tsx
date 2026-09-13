import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionFilterBar } from './CollectionFilterBar';

const meta = {
  component: CollectionFilterBar,
} satisfies Meta<typeof CollectionFilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    typeFilter: 'all',
    rarityFilter: 'all',
    specialFilter: null,
    tagFilter: [],
    affinityFilter: null,
    affinityLabels: ['Death Rally', 'Iron Bond'],
    sortKey: 'default',
    groupKey: 'none',
    openMenu: null,
    onOpenMenuChange: fn(),
    onTypeChange: fn(),
    onRarityChange: fn(),
    onSpecialChange: fn(),
    onTagToggle: fn(),
    onAffinityChange: fn(),
    onSortChange: fn(),
    onGroupChange: fn(),
    onResetFilters: fn(),
    shownCount: 128,
    totalOwned: 340,
  },
};

export const WithActiveFilters: Story = {
  args: {
    ...Default.args,
    typeFilter: 'unit',
    specialFilter: 'upgradeable',
    tagFilter: ['flying'],
    openMenu: 'filters',
  },
};
