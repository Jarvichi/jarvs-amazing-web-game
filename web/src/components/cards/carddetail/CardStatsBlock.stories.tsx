import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardStatsBlock } from './CardStatsBlock';
import { exampleUnitTemplate } from '../../../game/types.sample';

const meta = {
  component: CardStatsBlock,
} satisfies Meta<typeof CardStatsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoBonuses: Story = {
  args: {
    unit: exampleUnitTemplate,
    atkBonus: 0,
    hpBonus: 0,
    augmentEffect: {},
    hasStatBonus: false,
    showBreakdown: false,
    onToggleBreakdown: fn(),
  },
};

export const WithBonuses: Story = {
  args: {
    unit: exampleUnitTemplate,
    atkBonus: 3,
    hpBonus: 6,
    augmentEffect: { attack: 2, maxHp: 4 },
    hasStatBonus: true,
    showBreakdown: false,
    onToggleBreakdown: fn(),
  },
};

export const BreakdownOpen: Story = {
  args: {
    ...WithBonuses.args,
    showBreakdown: true,
  },
};

export const Structure: Story = {
  args: {
    unit: { ...exampleUnitTemplate, moveSpeed: 0, maxHp: 30 },
    atkBonus: 0,
    hpBonus: 3,
    augmentEffect: {},
    hasStatBonus: true,
    showBreakdown: true,
    onToggleBreakdown: fn(),
  },
};
