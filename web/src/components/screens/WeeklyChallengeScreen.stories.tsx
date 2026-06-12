import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeeklyChallengeScreen } from './WeeklyChallengeScreen';

const meta = {
  component: WeeklyChallengeScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WeeklyChallengeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onStart: fn(),
    onBack: fn(),
  },
};
