import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardBattleStatsBlock } from './CardBattleStatsBlock';

const meta = {
  component: CardBattleStatsBlock,
} satisfies Meta<typeof CardBattleStatsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    timesPlayed: 42,
    unitsLost: 7,
  },
};

export const NoUnitDeaths: Story = {
  args: {
    timesPlayed: 12,
  },
};
