import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FilterOption } from './FilterOption';

const meta = {
  component: FilterOption,
  parameters: { layout: 'centered' },
  title: 'UI/Filters/FilterOption',
  decorators: [(Story) => <div style={{ background: 'var(--game-bg)', padding: 20, display: 'flex', gap: 8 }}><Story /></div>],
} satisfies Meta<typeof FilterOption>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inactive: Story = { args: { active: false, onClick: fn(), children: 'Common' } };
export const Active: Story = { args: { active: true, onClick: fn(), children: 'Common' } };
export const GoldActive: Story = { args: { active: true, gold: true, onClick: fn(), children: '★ Upgradeable' } };
