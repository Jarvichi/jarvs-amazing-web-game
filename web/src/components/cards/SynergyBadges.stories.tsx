import type { Meta, StoryObj } from '@storybook/react-vite';

import { SynergyBadges } from './SynergyBadges';
import { SYNERGY_GROUPS } from '../../game/synergies';

const meta = {
  component: SynergyBadges,
  tags: ['ci'],
} satisfies Meta<typeof SynergyBadges>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SingleGroup: Story = {
  args: {
    groups: SYNERGY_GROUPS.slice(0, 1),
  },
};

export const TwoGroups: Story = {
  args: {
    groups: SYNERGY_GROUPS.slice(0, 2),
  },
};

/** More groups than fit — only the first two render, the rest stay in the tooltip. */
export const OverflowingGroups: Story = {
  args: {
    groups: SYNERGY_GROUPS.slice(0, 4),
  },
};

/** Deck builder context: the ⚡ count is how many deck cards this one pairs with. */
export const WithDeckMatches: Story = {
  args: {
    groups: SYNERGY_GROUPS.slice(0, 2),
    deckMatches: 3,
  },
};

/** No groups and no deck matches — renders nothing rather than an empty box. */
export const Empty: Story = {
  args: {
    groups: [],
  },
};
