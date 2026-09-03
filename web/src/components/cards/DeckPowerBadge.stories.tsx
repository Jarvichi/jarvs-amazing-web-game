import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeckPowerBadge } from './DeckPowerBadge';
import { DECK_POWER_BANDS, DeckPowerBreakdown } from '../../game/deckPower';

const meta = {
  component: DeckPowerBadge,
  tags: ['ci'],
} satisfies Meta<typeof DeckPowerBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function breakdown(over: Partial<DeckPowerBreakdown> = {}): DeckPowerBreakdown {
  const rating = over.rating ?? 93;
  return {
    rating,
    band: DECK_POWER_BANDS.find(b => rating >= b.min) ?? DECK_POWER_BANDS[0],
    meanRatio: rating / 100,
    consistency: 1.1,
    cardCount: 30,
    uniqueCount: 8,
    topCards: [
      { name: 'Barracks', ratio: 6.1 },
      { name: 'Centaur Run', ratio: 4.7 },
      { name: 'Eel Trench', ratio: 4.2 },
      { name: 'Arcane Tower', ratio: 2.9 },
      { name: 'Plague Den', ratio: 2.2 },
    ],
    ...over,
  };
}

/** Tier bands are picked by rating, so each story just moves the number. */
function at(rating: number): DeckPowerBreakdown {
  let band = DECK_POWER_BANDS[0];
  for (const b of DECK_POWER_BANDS) if (rating >= b.min) band = b;
  return breakdown({ rating, band });
}

/** The starter deck — the rating scale's anchor. */
export const Recruit: Story = {
  args: { power: at(93) },
};

export const Seasoned: Story = {
  args: { power: at(166) },
};

export const Veteran: Story = {
  args: { power: at(290) },
};

/** A mastered spawner deck under the Siege Commander discount. */
export const Elite: Story = {
  args: { power: at(373) },
};

/** Max-copy cheap spawners — the deck shape that walks the campaign today. */
export const Mythic: Story = {
  args: { power: at(780) },
};

/** An empty deck has nothing to rate, so the badge stays out of the header. */
export const EmptyDeck: Story = {
  args: { power: breakdown({ rating: 0, cardCount: 0, uniqueCount: 0, topCards: [] }) },
};

/** A deck of 30 distinct names earns no consistency bonus, so that note hides. */
export const NoConsistencyBonus: Story = {
  args: { power: breakdown({ rating: 240, consistency: 1, uniqueCount: 30 }) },
};
