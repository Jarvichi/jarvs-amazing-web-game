import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';

import { ToastProvider, useToast, type ToastVariant } from './Toast';
import { IconSprite } from './icons/IconSprite';

const meta = {
  title: 'UI/Toast',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function FireOnMount({ variant, message }: { variant: ToastVariant; message: string }) {
  const { showToast } = useToast();
  useEffect(() => {
    showToast(message, { variant, duration: 999999 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div style={{ color: 'var(--game-text-color)', padding: 40 }}>Toast fired on mount — see the stack.</div>;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 360, height: 200, background: 'var(--game-bg)' }}>
      <IconSprite />
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}

export const Info: Story = {
  render: () => <Wrapper><FireOnMount variant="info" message="Auto-saved." /></Wrapper>,
};

export const Success: Story = {
  render: () => <Wrapper><FireOnMount variant="success" message="Card mastered!" /></Wrapper>,
};

export const Reward: Story = {
  render: () => <Wrapper><FireOnMount variant="reward" message="+250 crystals!" /></Wrapper>,
};

export const Warning: Story = {
  render: () => <Wrapper><FireOnMount variant="warning" message="Not enough gold!" /></Wrapper>,
};

export const ErrorVariant: Story = {
  name: 'Error',
  render: () => <Wrapper><FireOnMount variant="error" message="Sync failed. Check your connection." /></Wrapper>,
};

function FireThree() {
  const { showToast } = useToast();
  useEffect(() => {
    showToast('First message queued.', { variant: 'info', duration: 999999 });
    showToast('Second message queued.', { variant: 'success', duration: 999999 });
    showToast('Third message queued — stacked, not overlapping.', { variant: 'reward', duration: 999999 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div style={{ color: 'var(--game-text-color)', padding: 40 }}>Fired three toasts simultaneously.</div>;
}

export const StackedQueue: Story = {
  render: () => (
    <div style={{ position: 'relative', width: 420, height: 260, background: 'var(--game-bg)' }}>
      <IconSprite />
      <ToastProvider><FireThree /></ToastProvider>
    </div>
  ),
};
