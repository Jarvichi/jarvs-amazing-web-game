import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PlayerStatsScreen } from './PlayerStatsScreen';

const meta = {
  component: PlayerStatsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PlayerStatsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
