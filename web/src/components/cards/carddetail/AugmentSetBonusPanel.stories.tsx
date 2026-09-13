import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentSetBonusPanel } from './AugmentSetBonusPanel';

const meta = {
  component: AugmentSetBonusPanel,
} satisfies Meta<typeof AugmentSetBonusPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const partialSet = {
  helmet: { instanceId: 'i-1', cardId: 'Thunder Helm', level: 1, equippedToCardName: 'Knight' },
  chest: { instanceId: 'i-2', cardId: 'Thunder Cuirass', level: 1, equippedToCardName: 'Knight' },
}

const fullSet = {
  helmet:        { instanceId: 'i-1', cardId: 'Thunder Helm',      level: 1, equippedToCardName: 'Knight' },
  chest:         { instanceId: 'i-2', cardId: 'Thunder Cuirass',   level: 1, equippedToCardName: 'Knight' },
  arms:          { instanceId: 'i-3', cardId: 'Thunder Gauntlets', level: 1, equippedToCardName: 'Knight' },
  legs:          { instanceId: 'i-4', cardId: 'Thunder Cuisses',   level: 1, equippedToCardName: 'Knight' },
  amulet:        { instanceId: 'i-5', cardId: 'Thunder Amulet',    level: 1, equippedToCardName: 'Knight' },
  primaryRanged: { instanceId: 'i-6', cardId: 'Thunder Bow',       level: 1, equippedToCardName: 'Knight' },
  heavyMelee:    { instanceId: 'i-7', cardId: 'Thunder Blade',     level: 1, equippedToCardName: 'Knight' },
}

export const PartialSet: Story = {
  args: {
    equippedMap: partialSet,
    setBonus: undefined,
  },
};

export const FullSetActive: Story = {
  args: {
    equippedMap: fullSet,
    setBonus: { setName: 'Thunder', effect: { attackRange: 8, attack: 2 }, description: 'Lightning crackling through every strike' },
  },
};
