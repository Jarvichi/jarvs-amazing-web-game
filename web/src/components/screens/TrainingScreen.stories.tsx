import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrainingScreen } from './TrainingScreen';

const meta = {
  component: TrainingScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TrainingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
    onStart: fn(),
  },
};
