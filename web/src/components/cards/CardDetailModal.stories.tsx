import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDetailModal } from './CardDetailModal';

import { exampleCard } from '../../game/types.sample';
import { getCardCatalog } from '../../game/cards';

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

/**
 * A real catalogue card, so the SYNERGY row has something to show — a spawner
 * link to the unit it produces plus its synergy groups. `exampleCard` is not in
 * the catalogue and has neither.
 */
export const WithSynergy: Story = {
  args: {
    "card": getCardCatalog().find(c => c.name === 'Ancient Barracks')!,
    "collection": [],
    "onClose": fn()
  },
};