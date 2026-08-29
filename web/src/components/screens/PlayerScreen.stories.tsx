import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PlayerScreen } from './PlayerScreen';

const meta = {
  component: PlayerScreen,
  parameters: { layout: 'fullscreen' },
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
