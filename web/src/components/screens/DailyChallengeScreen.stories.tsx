import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DailyChallengeScreen } from './DailyChallengeScreen';

const meta = {
  component: DailyChallengeScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DailyChallengeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onStart: fn(),
    onBack: fn(),
  },
};
