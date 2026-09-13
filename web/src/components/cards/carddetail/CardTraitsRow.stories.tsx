import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardTraitsRow } from './CardTraitsRow';

const meta = {
  component: CardTraitsRow,
} satisfies Meta<typeof CardTraitsRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    traits: ['flying', 'ranged', 'fast'],
  },
};

export const None: Story = {
  args: {
    traits: [],
  },
};
