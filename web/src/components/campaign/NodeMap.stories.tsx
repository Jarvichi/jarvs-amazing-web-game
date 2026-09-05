import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NodeMap } from './NodeMap';
import { exampleAct, exampleRunState } from '../../game/types.sample';
import type { Act } from '../../game/questline';
import act9 from '../../data/acts/act9.json';

const meta = {
  component: NodeMap,
  parameters: { layout: 'fullscreen' },
  // The screen is a full-height flex column in the app, and the map sizes
  // itself to the room its container gives it — rendered bare, it would lay
  // out against an unbounded height and show nothing the app ever shows.
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
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

// A real act, not the 3x2 sample: 16 columns wide, and carrying the longest
// node names in the game ("Fractured Glacier Face"). The sample act fits in a
// space no shipped map does, and its labels are short enough never to wrap.
export const RealAct: Story = {
  args: {
    act: act9 as unknown as Act,
    run: { ...exampleRunState, actId: 'act9', completedNodeIds: [], pendingNodeId: null },
    onSelectNode: fn(),
    onUseConsumable: fn(),
    onBack: fn(),
  },
};
