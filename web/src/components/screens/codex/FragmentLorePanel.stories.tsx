import type { Meta, StoryObj } from '@storybook/react-vite';

import { FragmentLorePanel } from './FragmentLorePanel';

const meta = {
  component: FragmentLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FragmentLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Discovered: Story = {
  args: {
    entry: {
      id: 'frag-act1-1',
      actId: 'act1',
      nodeId: 'node3',
      title: 'A Traveler\'s Journal',
      body: 'Day 14. The vale grows quieter each night.\n\nI fear we are not alone here.',
      discovered: true,
    },
  },
};

export const Undiscovered: Story = {
  args: {
    entry: {
      id: 'frag-act1-1',
      actId: 'act1',
      nodeId: 'node3',
      title: '',
      body: '',
      discovered: false,
    },
  },
};
