import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardTile } from './CardTile';
import { exampleCard } from '../game/types.sample';




const meta = {
  component: CardTile,
} satisfies Meta<typeof CardTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: exampleCard,
  },
};