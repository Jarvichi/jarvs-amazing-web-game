import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShareDeckModal } from './ShareDeckModal';

const meta = {
  component: ShareDeckModal,
} satisfies Meta<typeof ShareDeckModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    deckCode: 'JARV1-XKQJ2-9ZP4M',
    shareCodeRef: { current: null },
    copyFeedback: false,
    onCopy: fn(),
    importCode: '',
    importError: '',
    onImportCodeChange: fn(),
    onImport: fn(),
    onClose: fn(),
  },
};

export const Copied: Story = {
  args: {
    ...Default.args,
    copyFeedback: true,
  },
};

export const ImportError: Story = {
  args: {
    ...Default.args,
    importCode: 'not-a-real-code',
    importError: 'Invalid code — could not decode.',
  },
};
