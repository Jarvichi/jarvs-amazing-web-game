import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlowStatusBar } from './FlowStatusBar';

const meta = {
  component: FlowStatusBar,
  parameters: { layout: 'centered' },
  args: { basinsFed: 1, basinTotal: 3, leaks: 2, solved: false },
} satisfies Meta<typeof FlowStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MidSolve: Story = {};
export const Untouched: Story = { args: { basinsFed: 0, leaks: 6 } };
export const OneLeakLeft: Story = { args: { basinsFed: 3, leaks: 1 } };
export const Solved: Story = { args: { basinsFed: 3, leaks: 0, solved: true } };
