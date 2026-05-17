import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ModalBackdrop } from './ModalBackdrop';

const meta = {
  component: ModalBackdrop,
  parameters: { layout: 'fullscreen' },
  title: 'UI/ModalBackdrop',
} satisfies Meta<typeof ModalBackdrop>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClose: fn(),
    children: (
      <div style={{ background: '#1a1a2e', padding: '2rem', borderRadius: '8px', color: 'white', minWidth: '300px' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>Modal Title</h2>
        <p style={{ margin: 0 }}>Click outside the box to close.</p>
      </div>
    ),
  },
};

export const WithZIndex: Story = {
  args: {
    onClose: fn(),
    zIndex: 9999,
    children: (
      <div style={{ background: '#1a1a2e', padding: '2rem', borderRadius: '8px', color: 'white', minWidth: '300px' }}>
        <p style={{ margin: 0 }}>High z-index modal.</p>
      </div>
    ),
  },
};
