import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { QuestsScreen } from './QuestsScreen';

const meta = {
  component: QuestsScreen,
  parameters: { layout: 'fullscreen' },
  // QuestChainCard's step rows are ListRows, which read colour from
  // --row-*, defined on .game-container (base.css) — real usage always
  // sits inside it, same reasoning as CollectionScreen's own decorator.
  decorators: [(Story) => (
    <div className="game-container" style={{ height: '100vh' }}>
      <Story />
    </div>
  )],
} satisfies Meta<typeof QuestsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
