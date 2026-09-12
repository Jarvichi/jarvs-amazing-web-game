import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatUpgradeScreen } from './StatUpgradeScreen';

const meta = {
  component: StatUpgradeScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <div className="game-container" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof StatUpgradeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSelect: fn(),
  },
};
