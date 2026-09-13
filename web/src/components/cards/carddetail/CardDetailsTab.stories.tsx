import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailsTab } from './CardDetailsTab';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: CardDetailsTab,
} satisfies Meta<typeof CardDetailsTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: { ...exampleCard, unit: { ...exampleCard.unit!, strengths: ['flying'] } },
    traits: ['flying', 'fast'],
    synergyGroups: [],
    comboLinks: [],
    expandedRow: null,
    onToggleRow: fn(),
    masteryLvl: 2,
    xp: 40,
    timesPlayed: 12,
    unitsLost: 3,
  },
};

export const Augment: Story = {
  args: {
    card: {
      ...exampleCard,
      cardType: 'augment',
      unit: undefined,
      augmentEffect: { maxHp: 20 },
      setName: 'Thunder',
      augmentSlot: 'helmet',
    },
    traits: [],
    synergyGroups: [],
    comboLinks: [],
    expandedRow: null,
    onToggleRow: fn(),
    masteryLvl: 0,
    xp: 0,
    augmentLevel: 2,
    augmentEquippedTo: 'Knight',
    timesPlayed: 0,
  },
};
