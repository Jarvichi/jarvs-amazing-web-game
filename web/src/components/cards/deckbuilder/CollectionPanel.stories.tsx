import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionPanel } from './CollectionPanel';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: CollectionPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CollectionPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithCards: Story = {
  args: {
    collapsed: false,
    onToggleCollapse: fn(),
    shownCount: 2,
    search: '',
    onSearchChange: fn(),
    onClearSearch: fn(),
    typeFilter: 'all',
    rarityFilter: 'all',
    tagFilter: [],
    affinityFilter: null,
    affinityLabels: [],
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
    items: [
      { card: exampleCard, inDeck: 2, owned: 4, canAdd: true, atCopyLimit: false, resting: false, xp: 0, level: 0, comboCount: 0, synergyGroupCount: 0, groupLabel: null },
      { card: { ...exampleCard, name: 'Archer', rarity: 'rare' }, inDeck: 4, owned: 4, canAdd: false, atCopyLimit: true, resting: false, xp: 40, level: 2, comboCount: 1, synergyGroupCount: 1, groupLabel: null },
    ],
    onAdd: fn(),
    onInfo: fn(),
  },
};

export const Collapsed: Story = {
  args: {
    ...WithCards.args,
    collapsed: true,
  },
};
