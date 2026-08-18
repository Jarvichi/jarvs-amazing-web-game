import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StanceBar } from './StanceBar';

const meta = {
  component: StanceBar,
  parameters: { layout: 'centered' },
  title: 'Battle/StanceBar',
  decorators: [(Story) => <div style={{ background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof StanceBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = { onSetStance: fn(), onCycleSpeed: fn() };

export const Default: Story = {
  args: {
    ...callbacks,
    stance: 'auto',
    allowedStances: null,
    suddenDeath: false,
    onCooldown: false,
    cooldownSecsLeft: 0,
    durationSecsLeft: 0,
    speedMultiplier: 1,
  },
};

export const ActiveWithDuration: Story = {
  args: {
    ...callbacks,
    stance: 'attack',
    allowedStances: null,
    suddenDeath: false,
    onCooldown: false,
    cooldownSecsLeft: 0,
    durationSecsLeft: 8,
    speedMultiplier: 2,
  },
};

export const OnCooldown: Story = {
  args: {
    ...callbacks,
    stance: 'auto',
    allowedStances: null,
    suddenDeath: false,
    onCooldown: true,
    cooldownSecsLeft: 12,
    durationSecsLeft: 0,
    speedMultiplier: 1,
  },
};

export const SuddenDeath: Story = {
  args: {
    ...callbacks,
    stance: 'attack',
    allowedStances: null,
    suddenDeath: true,
    onCooldown: false,
    cooldownSecsLeft: 0,
    durationSecsLeft: 0,
    speedMultiplier: 4,
  },
};
