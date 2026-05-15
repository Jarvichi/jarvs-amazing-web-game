import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelicBreakModal } from './RelicBreakModal';

const meta = {
  component: RelicBreakModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RelicBreakModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    relicName: 'Bark Shield',
    brokenName: 'Cracked Bark Shield',
    brokenIcon: '🛡️',
    brokenDesc: 'A shattered remnant of what was once a powerful shield.',
    onContinue: fn(),
  },
};
