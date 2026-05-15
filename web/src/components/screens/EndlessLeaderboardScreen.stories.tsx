import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EndlessLeaderboardScreen } from './EndlessLeaderboardScreen';

const meta = {
  component: EndlessLeaderboardScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EndlessLeaderboardScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
