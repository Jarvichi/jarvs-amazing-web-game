import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LoginModal } from './LoginModal';

const meta = {
  component: LoginModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoginModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    user: null,
    authLoading: false,
    onClose: fn(),
    onLoginSuccess: fn(),
  },
};

export const Loading: Story = {
  args: {
    user: null,
    authLoading: true,
    onClose: fn(),
    onLoginSuccess: fn(),
  },
};
