import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeleteAccountModal } from './DeleteAccountModal';

const meta = {
  component: DeleteAccountModal,
  title: 'Modals/DeleteAccountModal',
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DeleteAccountModal>;

export default meta;

type Story = StoryObj<typeof meta>;

const base = {
  email: 'player@example.com',
  busy: false,
  error: null,
  onConfirm: fn(),
  onCancel: fn(),
};

/** Confirm stays disabled until a password is typed. */
export const Default: Story = { args: base };

export const Deleting: Story = { args: { ...base, busy: true } };

export const WrongPassword: Story = {
  args: { ...base, error: 'Incorrect password.' },
};
