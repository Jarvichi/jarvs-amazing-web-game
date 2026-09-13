import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardExpandableRow } from './CardExpandableRow';

const meta = {
  component: CardExpandableRow,
} satisfies Meta<typeof CardExpandableRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: {
    labelContent: '⚔ Strong vs',
    labelClassName: 'cdm-sw-label--strong',
    tagsText: 'flying, magic',
    expanded: false,
    onToggle: fn(),
    children: 'Deals ×1.5 damage against units tagged: flying, magic',
  },
};

export const Expanded: Story = {
  args: {
    ...Collapsed.args,
    expanded: true,
  },
};
