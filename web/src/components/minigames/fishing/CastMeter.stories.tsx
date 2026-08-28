import type { Meta, StoryObj } from '@storybook/react-vite';

import { CastMeter } from './CastMeter';

const meta = {
  component: CastMeter,
  parameters: { layout: 'centered' },
  args: { power: 55 },
} satisfies Meta<typeof CastMeter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story    = {};
export const Margin: Story     = { args: { power: 8 } };
export const DeepChannel: Story = { args: { power: 78 } };
export const FarHorizon: Story = { args: { power: 100 } };
export const Locked: Story     = { args: { power: 0, locked: true } };
