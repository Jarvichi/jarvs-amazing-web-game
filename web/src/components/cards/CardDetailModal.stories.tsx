import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailModal } from './CardDetailModal';

import { exampleCard } from '../../game/types.sample';

const meta = {
  component: CardDetailModal,
} satisfies Meta<typeof CardDetailModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "card": exampleCard,
    "collection": [],
    "onClose": fn()
  },
};