import type { Meta, StoryObj } from '@storybook/react-vite';

import { FishingScene } from './FishingScene';

const meta = {
  component: FishingScene,
  parameters: { layout: 'centered' },
  args: { variant: 'river', phase: 'waiting', castPower: 65, fishPos: 0.5 },
} satisfies Meta<typeof FishingScene>;

export default meta;

type Story = StoryObj<typeof meta>;

// ── Phases (river) ──
export const Idle: Story        = { args: { phase: 'idle' } };
export const Charging: Story    = { args: { phase: 'charging', castPower: 40 } };
export const Waiting: Story     = { args: { phase: 'waiting' } };
export const Bite: Story        = { args: { phase: 'bite' } };
export const FightDeep: Story   = { args: { phase: 'fight', fishPos: 0.15 } };
export const FightSurface: Story = { args: { phase: 'fight', fishPos: 0.9 } };
export const Missed: Story      = { args: { phase: 'missed' } };
export const Caught: Story      = { args: { phase: 'caught', catchIcon: '🏆' } };

// ── Locale themes ──
export const Lake: Story  = { args: { variant: 'lake' } };
export const Cave: Story  = { args: { variant: 'cave' } };
export const Ocean: Story = { args: { variant: 'ocean' } };

// ── Cast distance ──
export const ShortCast: Story = { args: { castPower: 5 } };
export const LongCast: Story  = { args: { castPower: 100 } };
