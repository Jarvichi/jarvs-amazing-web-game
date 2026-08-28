import type { Meta, StoryObj } from '@storybook/react-vite';

import { ReelGauge } from './ReelGauge';

const meta = {
  component: ReelGauge,
  parameters: { layout: 'centered' },
  args: { bandPos: 0.45, bandSize: 0.3, fishPos: 0.45, gauge: 0.4, holding: true },
} satisfies Meta<typeof ReelGauge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Fish inside the band — the gauge is filling. */
export const Hooked: Story = {};

/** Fish has run clear of the band; the gauge is draining. */
export const FishEscaping: Story = {
  args: { bandPos: 0.2, fishPos: 0.85, gauge: 0.15, holding: false },
};

/** A big fish: narrow band, gauge nearly full. */
export const NearlyLanded: Story = {
  args: { bandSize: 0.16, bandPos: 0.7, fishPos: 0.7, gauge: 0.92, holding: true },
};
