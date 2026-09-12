import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CodexScreen } from './CodexScreen';

const meta = {
  component: CodexScreen,
  parameters: { layout: 'fullscreen' },
  // Real usage always sits inside .game-container (#2183).
  decorators: [(Story) => (
    <div className="game-container" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof CodexScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
