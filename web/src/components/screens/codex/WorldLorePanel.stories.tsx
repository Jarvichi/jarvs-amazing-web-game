import type { Meta, StoryObj } from '@storybook/react-vite';

import { WorldLorePanel } from './WorldLorePanel';

const meta = {
  component: WorldLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof WorldLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  args: {
    entry: {
      actId: 'act1',
      title: 'The Splintered Vale',
      subtitle: 'Where the first shard fell',
      environment: 'forest',
      bossName: 'The Hollow Warden',
      bossDescription: 'A knight bound to guard a shard it no longer remembers.',
      shardLore: 'The vale still glows faintly where the shard struck.',
      unlocked: true,
    },
  },
};

export const NoGuardian: Story = {
  args: {
    entry: {
      actId: 'act2',
      title: 'The Ashen Reach',
      subtitle: 'A land still smoldering',
      environment: 'wasteland',
      bossName: '???',
      bossDescription: '',
      shardLore: '',
      unlocked: true,
    },
  },
};

export const Locked: Story = {
  args: {
    entry: {
      actId: 'act1',
      title: 'The Splintered Vale',
      subtitle: '',
      environment: '',
      bossName: '???',
      bossDescription: '',
      shardLore: '',
      unlocked: false,
    },
  },
};
