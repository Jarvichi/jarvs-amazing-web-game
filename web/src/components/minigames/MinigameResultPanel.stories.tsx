import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MinigameResultPanel } from './MinigameResultPanel';

const meta = {
  component: MinigameResultPanel,
  parameters: { layout: 'centered' },
  render: (args) => (
    <div style={{ background: '#0a0a14', padding: 48 }}>
      <MinigameResultPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof MinigameResultPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithBreakdown: Story = {
  args: {
    headline: '✨ PERFECT!',
    ctaLabel: 'COLLECT & EXIT',
    onCta: fn(),
    children: (
      <div className="minigame-result-breakdown">
        <div>Base (8 pairs): +40 🎫</div>
        <div>Perfect bonus: +30 🎫</div>
        <div>Speed bonus: +10 🎫</div>
        <div className="minigame-result-total">Total: 80 🎫</div>
      </div>
    ),
  },
};

export const SimpleHeadline: Story = {
  args: {
    headline: 'Nice work!',
    ctaLabel: 'COLLECT & EXIT',
    onCta: fn(),
    children: <div className="minigame-result-total">Total: 25 🎫</div>,
  },
};

export const Ember: Story = {
  args: {
    headline: 'Out of credits!',
    ctaLabel: 'EXIT',
    onCta: fn(),
    tone: 'ember',
    children: <div className="minigame-result-total">Cashed out: 0 credits</div>,
  },
};
