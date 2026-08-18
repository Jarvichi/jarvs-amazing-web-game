import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Modal } from './Modal';

const meta = {
  component: Modal,
  parameters: { layout: 'fullscreen' },
  title: 'UI/Modal',
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Confirm Action',
    onClose: fn(),
    children: <p style={{ margin: 0 }}>Are you sure you want to do this?</p>,
  },
};

export const WithFooter: Story = {
  args: {
    title: 'Discard Deck?',
    onClose: fn(),
    tone: 'danger',
    children: <p style={{ margin: 0 }}>This can&apos;t be undone.</p>,
    footer: (
      <>
        <button className="action-btn" onClick={fn()}>Cancel</button>
        <button className="action-btn action-btn--danger" onClick={fn()}>Discard</button>
      </>
    ),
  },
};

export const GoldTone: Story = {
  args: {
    title: 'Reward Claimed',
    onClose: fn(),
    tone: 'gold',
    children: <p style={{ margin: 0 }}>You received 100 gold.</p>,
  },
};
