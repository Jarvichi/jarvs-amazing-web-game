import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FilterPill } from './FilterPill';

const meta = {
  component: FilterPill,
  parameters: { layout: 'centered' },
  title: 'UI/Filters/FilterPill',
  decorators: [(Story) => <div style={{ background: 'var(--game-bg)', padding: 20, display: 'flex', gap: 8 }}><Story /></div>],
} satisfies Meta<typeof FilterPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onRemove: fn(), children: 'units' } };

export const Row: Story = {
  args: { onRemove: fn(), children: 'units' },
  render: () => (
    <>
      <FilterPill onRemove={fn()}>units</FilterPill>
      <FilterPill onRemove={fn()}>rare</FilterPill>
      <FilterPill onRemove={fn()}>affinity:Death Rally</FilterPill>
    </>
  ),
};
