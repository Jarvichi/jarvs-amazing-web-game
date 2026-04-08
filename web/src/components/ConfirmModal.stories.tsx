import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConfirmModal } from './ConfirmModal';

const meta = {
  component: ConfirmModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConfirmModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Abandon Run?',
    body: 'All progress for this run will be lost.',
    confirmLabel: '[ Yes, Abandon ]',
    onConfirm: fn(),
    onCancel: fn(),
  },
};
