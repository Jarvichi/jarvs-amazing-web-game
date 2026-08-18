import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FilterPopup } from './FilterPopup';
import { FilterOption } from './FilterOption';

const meta = {
  component: FilterPopup,
  parameters: { layout: 'centered' },
  title: 'UI/Filters/FilterPopup',
  decorators: [(Story) => <div style={{ background: 'var(--game-bg)', padding: 40 }}><Story /></div>],
} satisfies Meta<typeof FilterPopup>;

export default meta;

type Story = StoryObj<typeof meta>;

const options = ['All', 'Unit', 'Structure', 'Upgrade'];

export const Closed: Story = {
  args: {
    label: '▼ FILTERS',
    isActive: false,
    open: false,
    onToggle: fn(),
    onClose: fn(),
    children: null,
  },
};

export const Open: Story = {
  args: {
    label: '▼ FILTERS',
    isActive: true,
    activeSuffix: ' (2)',
    open: true,
    onToggle: fn(),
    onClose: fn(),
    children: (
      <div className="filter-popup-section u-col">
        <span className="filter-group-label">TYPE</span>
        <div className="filter-popup-btns u-flex u-wrap u-gap-2">
          {options.map((label, i) => (
            <FilterOption key={label} active={i === 1} onClick={fn()}>{label}</FilterOption>
          ))}
        </div>
      </div>
    ),
    footer: (
      <div className="filter-popup-footer">
        <button className="filter-btn filter-btn--sm filter-btn--reset" onClick={fn()}>✕ Clear all filters</button>
      </div>
    ),
  },
};
