import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section } from './Section';

const meta = {
  component: Section,
} satisfies Meta<typeof Section>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Stats',
    children: 'Section content goes here.',
  },
};

export const Bordered: Story = {
  args: {
    title: 'Inventory',
    bordered: true,
    children: 'Bordered section content.',
  },
};

export const WithHeaderRight: Story = {
  args: {
    title: 'Collection',
    headerRight: '42 cards',
    children: 'Content with a right-aligned header element.',
  },
};
