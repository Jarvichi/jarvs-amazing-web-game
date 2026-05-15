import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NewsScreen } from './NewsScreen';

const meta = {
  component: NewsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NewsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
