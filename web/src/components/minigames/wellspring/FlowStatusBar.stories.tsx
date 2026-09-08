import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlowStatusBar } from './FlowStatusBar';

const meta = {
  component: FlowStatusBar,
  parameters: { layout: 'centered' },
  args: { fed: 9, total: 25, leaks: 2, solved: false },
} satisfies Meta<typeof FlowStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MidSolve: Story = {};
export const Untouched: Story = { args: { fed: 1, leaks: 1 } };
export const OneLeakLeft: Story = { args: { fed: 24, leaks: 1 } };
export const Solved: Story = { args: { fed: 25, leaks: 0, solved: true } };
