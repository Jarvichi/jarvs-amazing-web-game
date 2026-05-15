import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelicSelectScreen } from './RelicSelectScreen';

const meta = {
  component: RelicSelectScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RelicSelectScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    earnedRelics: ['Bark Shield', 'Iron Gauntlet', 'Golden Compass'],
    currentRelic: 'Bark Shield',
    onSelect: fn(),
  },
};

export const WithBrokenRelic: Story = {
  args: {
    earnedRelics: ['Bark Shield', 'Iron Gauntlet'],
    currentRelic: 'Iron Gauntlet',
    brokenRelic: { name: 'Cracked Bark Shield', icon: '🪨' },
    onSelect: fn(),
  },
};

export const NoRelic: Story = {
  args: {
    earnedRelics: ['Bark Shield'],
    currentRelic: null,
    onSelect: fn(),
  },
};
