import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FeedbackModal } from './FeedbackModal';

const meta = {
  component: FeedbackModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FeedbackModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  args: {
    user: null,
    onClose: fn(),
  },
};
