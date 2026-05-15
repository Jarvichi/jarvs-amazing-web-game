import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NodeMap } from './NodeMap';
import { exampleAct, exampleRunState } from '../../game/types.sample';

const meta = {
  component: NodeMap,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NodeMap>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    act: exampleAct,
    run: exampleRunState,
    onSelectNode: fn(),
    onUseConsumable: fn(),
    onBack: fn(),
  },
};

export const FreshRun: Story = {
  args: {
    act: exampleAct,
    run: {
      ...exampleRunState,
      completedNodeIds: [],
      playerHp: 50,
      maxHp: 50,
      livesRemaining: 3,
    },
    onSelectNode: fn(),
    onUseConsumable: fn(),
    onBack: fn(),
  },
};

export const LowHp: Story = {
  args: {
    act: exampleAct,
    run: {
      ...exampleRunState,
      completedNodeIds: ['node-1', 'node-2'],
      playerHp: 8,
      maxHp: 50,
      livesRemaining: 1,
    },
    onSelectNode: fn(),
    onUseConsumable: fn(),
    onBack: fn(),
  },
};
