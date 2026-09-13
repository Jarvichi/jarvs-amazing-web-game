import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardArtPanel } from './CardArtPanel';
import { exampleCard } from '../../../game/types.sample';

const meta = {
  component: CardArtPanel,
} satisfies Meta<typeof CardArtPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: exampleCard,
    owned: 4,
    inDeck: 2,
  },
};

export const NotInDeck: Story = {
  args: {
    card: exampleCard,
    owned: 1,
    inDeck: 0,
  },
};
