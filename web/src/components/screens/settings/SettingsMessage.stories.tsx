import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsMessage } from './SettingsMessage';

const meta = {
  component: SettingsMessage,
  title: 'Settings/SettingsMessage',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SettingsMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  args: { status: { text: 'Save synced.', kind: 'ok' } },
};

export const Error: Story = {
  args: { status: { text: 'Sync failed. Check your connection.', kind: 'error' } },
};

export const Warn: Story = {
  args: { status: { text: 'Cloud save found (12/03/2026, 14:22).', kind: 'warn' } },
};
