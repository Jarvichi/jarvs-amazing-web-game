import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeckFilterBar } from './DeckFilterBar';

const meta = {
  component: DeckFilterBar,
} satisfies Meta<typeof DeckFilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    typeFilter: 'all',
    rarityFilter: 'all',
    tagFilter: [],
    affinityFilter: null,
    affinityLabels: ['Death Rally', 'Iron Bond'],
    sortKey: 'default',
    groupKey: 'none',
    openMenu: null,
    onOpenMenuChange: fn(),
    onTypeChange: fn(),
    onRarityChange: fn(),
    onTagToggle: fn(),
    onAffinityChange: fn(),
    onSortChange: fn(),
    onGroupChange: fn(),
    onResetFilters: fn(),
  },
};

export const FiltersOpenWithActiveFilters: Story = {
  args: {
    ...Default.args,
    typeFilter: 'unit',
    tagFilter: ['flying', 'fast'],
    openMenu: 'filters',
  },
};
