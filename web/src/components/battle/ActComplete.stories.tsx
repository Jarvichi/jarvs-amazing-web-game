import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ActComplete } from './ActComplete';

const meta = {
  component: ActComplete,
} satisfies Meta<typeof ActComplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "actTitle": "actTitle",
    "actSubtitle": "actSubtitle",
    "relicName": "relicName",
    "relicDesc": "relicDesc",
    "onContinue": fn()
  },
};

/** #2294: shown when the player's deck-power band sits above what the act expects. */
export const OverqualifiedBonus: Story = {
  args: {
    actTitle: 'ACT I',
    actSubtitle: 'The Verdant Shard',
    relicName: 'Bark Shield',
    relicDesc: 'Your base gains +10 max HP at the start of every battle.',
    onContinue: fn(),
    overqualifiedCards: ['Golem', 'Iron Colossus', 'Dark Elf'],
  },
};