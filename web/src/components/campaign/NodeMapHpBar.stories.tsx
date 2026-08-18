import type { Meta, StoryObj } from '@storybook/react-vite';

import { NodeMapHpBar } from './NodeMapHpBar';

const meta = {
  component: NodeMapHpBar,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof NodeMapHpBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = { args: { hp: 100, maxHp: 100 } };
export const Mid: Story = { args: { hp: 45, maxHp: 100 } };
export const Low: Story = { args: { hp: 20, maxHp: 100 } };
export const Critical: Story = { args: { hp: 5, maxHp: 100 } };
