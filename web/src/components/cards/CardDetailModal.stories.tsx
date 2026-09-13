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

/**
 * Mastery ★5, so the stat rows show the value the engine actually fights with
 * (base + mastery) rather than the unmastered base, and the "where do these
 * come from?" breakdown toggle appears. 155 XP clears the level-5 threshold.
 */
export const Mastered: Story = {
  args: {
    "card": exampleCard,
    "collection": [{ cardName: exampleCard.name, count: 4, masteryXp: 155 }],
    "onClose": fn()
  },
};

/**
 * A mastered structure. Structures gain +10% max HP per mastery level and take
 * no augments at all (applyAugmentBonuses skips them), so only a mastery line
 * should ever appear in its breakdown.
 */
export const MasteredStructure: Story = {
  args: {
    "card": getCardCatalog().find(c => c.name === 'Ancient Barracks')!,
    "collection": [{ cardName: 'Ancient Barracks', count: 3, masteryXp: 155 }],
    "onClose": fn()
  },
};

/**
 * The header's rarity colour comes from theme.ts's RARITY_COLOR — one story
 * per rarity so a colour drift there is easy to spot at a glance (#2327).
 */
export const RarityCommon: Story = {
  args: { card: { ...exampleCard, rarity: 'common' }, collection: [], onClose: fn() },
};
export const RarityRare: Story = {
  args: { card: { ...exampleCard, rarity: 'rare' }, collection: [], onClose: fn() },
};
export const RarityLegendary: Story = {
  args: { card: { ...exampleCard, rarity: 'legendary' }, collection: [], onClose: fn() },
};
export const RarityMythic: Story = {
  args: { card: { ...exampleCard, rarity: 'mythic' }, collection: [], onClose: fn() },
};