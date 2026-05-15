import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelicSpinScreen } from './RelicSpinScreen';

const meta = {
  component: RelicSpinScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RelicSpinScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Survives: Story = {
  args: {
    relicName: 'Bark Shield',
    relicIcon: '🛡️',
    breaks: false,
    onContinue: fn(),
  },
};

export const Breaks: Story = {
  args: {
    relicName: 'Bark Shield',
    relicIcon: '🛡️',
    breaks: true,
    brokenName: 'Cracked Bark Shield',
    brokenIcon: '🪨',
    brokenDesc: 'A shattered remnant of a once-powerful relic.',
    onContinue: fn(),
  },
};
