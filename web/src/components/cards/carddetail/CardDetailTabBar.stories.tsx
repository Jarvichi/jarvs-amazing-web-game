import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailTabBar } from './CardDetailTabBar';
import { exampleUnitTemplate } from '../../../game/types.sample';

const meta = {
  component: CardDetailTabBar,
} satisfies Meta<typeof CardDetailTabBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DetailsActive: Story = {
  args: {
    cardName: 'Goblin',
    unit: exampleUnitTemplate,
    activeTab: 0,
    onTabChange: fn(),
    commanderName: null,
    promotionsLeft: 2,
    onPromote: fn(),
  },
};

export const AugmentsActive: Story = {
  args: {
    ...DetailsActive.args,
    activeTab: 1,
  },
};

export const CurrentCommander: Story = {
  args: {
    ...DetailsActive.args,
    commanderName: 'Goblin',
  },
};

export const PromotionLimitReached: Story = {
  args: {
    ...DetailsActive.args,
    promotionsLeft: 0,
  },
};
