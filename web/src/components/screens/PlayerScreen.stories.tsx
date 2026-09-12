import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PlayerScreen } from './PlayerScreen';

const meta = {
  component: PlayerScreen,
  parameters: { layout: 'fullscreen' },
  // Its Stats/Quests tabs use ListRow, which reads colour from --row-*,
  // defined on .game-container (base.css) — real usage always sits inside it.
  decorators: [(Story) => (
    <div className="game-container" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof PlayerScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    crystals: 1250,
    onCrystalsChanged: fn(),
    onBack: fn(),
  },
};

export const WithSignOut: Story = {
  args: {
    crystals: 1250,
    onCrystalsChanged: fn(),
    onBack: fn(),
    onSignOut: fn(),
  },
};
