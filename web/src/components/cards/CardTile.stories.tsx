import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardTile } from './CardTile';
import { exampleCard } from '../../game/types.sample';
import { getCardCatalog } from '../../game/cards';

const catalogCard = (name: string) => getCardCatalog().find(c => c.name === name)!;




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

export const CanAffordFalse: Story = {
  args: {
    card: exampleCard,
    canAfford: false,
  },
};

export const Disabled: Story = {
  args: {
    card: exampleCard,
    disabled: true, 
    },
};

export const LockedHero: Story = {
  args: {
    card: { ...exampleCard, isHero: true },
    lockedSecs: 15,
   },
};

export const IsHero: Story = {
  args: {
    card: { ...exampleCard, isHero: true },
   },
};

export const Upgradeable: Story = {
  args: {
    card: { ...exampleCard, upgradeEffect: { type: 'buffAttack', amount: 2 } },
    upgradeable: true,
   },
};

export const ShowDetails: Story = {
  args: {
    card: exampleCard,
    showDetails: true,  
  },
};

/**
 * A real catalogue card, so the synergy badges resolve. `exampleCard` is not in
 * the catalogue and therefore has no groups — deliberate, it keeps the other
 * stories showing the plain tile.
 */
export const WithSynergy: Story = {
  args: {
    card: catalogCard('Ancient Barracks'),
  },
};

/** Deck builder context — the ⚡ count is how many deck cards this one pairs with. */
export const WithDeckMatches: Story = {
  args: {
    card: catalogCard('Ancient Barracks'),
    deckMatches: 4,
  },
};

export const GlassRaritySecretBadgeCheck: Story = {
  args: {
    card: { ...exampleCard, rarity: 'glass', glassBreakChance: 0.15 },
    showDetails: true,
  },
};

export const AllProps: Story = {
  args: {
    card: { ...exampleCard, isHero: true, upgradeEffect: { type: 'buffAttack', amount: 2 } },
    canAfford: false,
    disabled: true,
    lockedSecs: 15,
    upgradeable: true,
    showDetails: true,  
  },
};