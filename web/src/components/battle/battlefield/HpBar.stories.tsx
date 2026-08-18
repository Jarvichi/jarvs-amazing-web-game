import type { Meta, StoryObj } from '@storybook/react-vite';

import { HpBar } from './HpBar';

const meta = {
  component: HpBar,
  parameters: { layout: 'centered' },
  title: 'Battle/HpBar',
  decorators: [(Story) => <div style={{ width: 220, background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof HpBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { current: 1000, max: 1000, color: '#33ff33' },
};

export const Half: Story = {
  args: { current: 480, max: 1000, color: '#33ff33' },
};

export const Low: Story = {
  args: { current: 90, max: 1000, color: '#ff4444' },
};

export const Critical: Story = {
  args: { current: 12, max: 1000, color: '#ff4444' },
};
