import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FeedbackAdminScreen } from './FeedbackAdminScreen';

const meta = {
  component: FeedbackAdminScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FeedbackAdminScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
