import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelicLorePanel } from './RelicLorePanel';

const meta = {
  component: RelicLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RelicLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  args: {
    relic: {
      name: 'Cracked Hourglass',
      icon: '⏳',
      desc: 'Gain an extra card draw each turn.',
      lore: 'Time slips through it, but never quite runs out.',
      exotic: false,
      unlocked: true,
    },
  },
};

export const Exotic: Story = {
  args: {
    relic: {
      name: "Warden's Last Ember",
      icon: '🔥',
      desc: 'All fire damage is doubled, but healing is halved.',
      lore: '',
      exotic: true,
      unlocked: true,
    },
  },
};

export const Locked: Story = {
  args: {
    relic: {
      name: 'Cracked Hourglass',
      icon: '⏳',
      desc: '',
      lore: '',
      exotic: false,
      unlocked: false,
    },
  },
};
