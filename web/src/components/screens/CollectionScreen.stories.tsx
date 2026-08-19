import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionScreen } from './CollectionScreen';

const meta = {
  component: CollectionScreen,
  parameters: { layout: 'fullscreen' },
  // Real usage always sits inside .game-container(--wide) (#2183) — without
  // it this story showed the grid at true unconstrained fullscreen width,
  // which is wider than the app ever actually renders it.
  decorators: [(Story) => (
    <div className="game-container game-container--wide" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof CollectionScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    crystals: 250,
    onCrystalsChanged: fn(),
    onBack: fn(),
    commanderName: null,
    onPromoteCommander: fn(),
  },
};
