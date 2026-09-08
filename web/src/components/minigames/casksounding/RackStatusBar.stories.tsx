import type { Meta, StoryObj } from '@storybook/react-vite';

import { RackStatusBar } from './RackStatusBar';

const meta = {
  component: RackStatusBar,
  parameters: { layout: 'centered' },
  args: { total: 11, named: 4, sorted: false },
} satisfies Meta<typeof RackStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MidSolve: Story = {};
export const Untouched: Story = { args: { named: 0 } };
export const OneLeft: Story = { args: { named: 10 } };
export const Sorted: Story = { args: { named: 11, sorted: true } };
