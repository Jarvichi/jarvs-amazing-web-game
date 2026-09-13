import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardCombatProfile } from './CardCombatProfile';
import { exampleUnitTemplate } from '../../../game/types.sample';

const meta = {
  component: CardCombatProfile,
} satisfies Meta<typeof CardCombatProfile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StrengthsAndWeaknesses: Story = {
  args: {
    unit: { ...exampleUnitTemplate, strengths: ['flying'], weaknesses: ['armored'] },
    masteryLvl: 0,
    expandedRow: null,
    onToggleRow: fn(),
  },
};

export const AffinityLocked: Story = {
  args: {
    unit: {
      ...exampleUnitTemplate,
      affinity: { withName: 'Archer', label: 'Death Rally', range: 120, effectType: 'attackSpeed', effectAmount: 1.25 },
    },
    masteryLvl: 0,
    expandedRow: 'affinity',
    onToggleRow: fn(),
  },
};

export const AffinityUnlocked: Story = {
  args: {
    ...AffinityLocked.args,
    masteryLvl: 2,
  },
};
