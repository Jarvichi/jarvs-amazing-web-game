import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { QuickBattleScreen } from './QuickBattleScreen';

const meta = {
  component: QuickBattleScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof QuickBattleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onStartBattle: fn(),
    onBack: fn(),
  },
};
