import { fn, within, userEvent, expect } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StanceBar } from './StanceBar';

const meta = {
  component: StanceBar,
  tags: ['ci'],
  parameters: { layout: 'centered' },
  title: 'Battle/StanceBar',
  decorators: [(Story) => <div style={{ background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof StanceBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = { onSetStance: fn(), onSetSpeed: fn() };

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

// Boss nodes restrict to 2 stances (see STANCE_RULES_BY_NODE_TYPE in
// app/screens.ts) — the clover renders as two halves instead of four
// quadrants for this case.
export const TwoStances: Story = {
  args: {
    ...callbacks,
    stance: 'defend',
    allowedStances: ['defend', 'auto'],
    suddenDeath: false,
    onCooldown: false,
    cooldownSecsLeft: 0,
    durationSecsLeft: 0,
    speedMultiplier: 1,
  },
};

// The collapsed clover is a single ~22px button by design (see the component
// doc comment) — these two stories click it open and assert the expanded
// overlay's petal count, so a regression collapsing to the wrong shape (e.g.
// still rendering 4 petals for a 2-stance node) fails a real assertion rather
// than only being catchable by eye.
export const ExpandedFourPetals: Story = {
  args: Default.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // StanceBar now renders SpeedClover beside it, which has its own "tap to
    // change" trigger — match on the Stance-specific label to avoid grabbing both.
    await userEvent.click(canvas.getByRole('button', { name: /^Stance:.*tap to change/i }))
    const group = await canvas.findByRole('group', { name: 'Stance' })
    expect(group.querySelectorAll('.stance-petal').length).toBe(4)
  },
};

export const ExpandedTwoPetals: Story = {
  args: TwoStances.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Stance:.*tap to change/i }))
    const group = await canvas.findByRole('group', { name: 'Stance' })
    expect(group.querySelectorAll('.stance-petal').length).toBe(2)
  },
};
