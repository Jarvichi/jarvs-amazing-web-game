# Card Synergies

How the game answers "what does this card work with". Read this before editing
`web/src/data/synergies.json`, adding a synergy group, or changing where synergy
information is surfaced.

Implementation: `web/src/game/synergies.ts`. Tests: `web/src/game/synergies.test.ts`.

## Two tiers

Nothing here is a new mechanic. Both tiers are read out of card data that already
drives the battle engine.

### Tier 1 — Synergy groups

Curated themes in `web/src/data/synergies.json`. A card is in a group when any of
its tags matches one of the group's `tags`, or when it is named in the group's
`cards` array. "Its tags" means `getAllCardTags` in `web/src/game/cards.ts` —
theme tags from `cards.json` plus the unit template's combat tags.

Broad signal: *these belong in the same deck*.

### Tier 2 — Combo links

Derived per card, no authoring:

| Kind | Source | Reads as |
|---|---|---|
| `affinity` | `unit.affinity` — the proximity buff `processAffinities` resolves each tick in `web/src/game/engine/units.ts` | "Near an Archer: +25% attack speed" |
| `spawns` | `unit.structureEffect` of type `spawn`, when the spawned template is itself a playable card | "Spawns a Goblin every 9s" |
| `spawned-by` | the reverse of `spawns` | "Ancient Barracks keeps producing these" |

Narrow signal, and mechanically real, so a combo link is weighted at **3×** a
shared group when scoring a card against a deck (`COMBO_WEIGHT` in
`synergies.ts`).

An affinity or spawn whose partner has no card of its own produces no link — the
player can't act on it.

## Groups

| Group | Tags | Members |
|---|---|---|
| ⚜ Dominion Core | `core` | 27 |
| ❄ Frostbind | `frost`, `glacier`, `waitedwinter` | 65 |
| 🔥 Emberkin | `ember`, `fire` | 45 |
| 🍄 Blight | `spore`, `fungal` | 40 |
| 💀 Deathless | `undead`, `ashen` | 50 |
| 🐾 Beastpack | `beast` | 47 |
| 🌩 Skyborne | `sky`, `storm` | 45 |
| 🌊 Tidewalkers | `reef`, `sunken`, `tidal` | 51 |
| ✨ Arcanum | `arcane`, `archive`, `spire` | 62 |
| 🛡 Iron Host | `iron`, `citadel` | 58 |
| ⚙ Clockwork | `clockwork` | 19 |
| 🏚 Siegeworks | `siege`, `vault`, `wreck` | 40 |
| 🏜 Dunerunners | `sand` | 34 |
| 🌲 Verdant | `forest` | 49 |
| 🌿 Canopy | `canopy` | 27 |
| 🗿 Ancients | `ancient`, `mercenary` | 48 |
| 🌫 Pale March | `marches`, `causeway` | 50 |
| 🌾 Harvest | `fields`, `orchard` | 50 |
| 🕯 Candlelight | `candlecity`, `vigilroads` | 50 |
| 🪞 Mirror Marsh | `marsh` | 25 |
| 🎭 Hollow Court | `court`, `throne` | 50 |
| 👑 Vigil Crown | `vigilcity`, `reaches` | 50 |

Around 92% of the catalogue falls in at least one group. The cards that don't
carry only generic combat tags (`melee`, `ranged`, `armored`, …) and have no
theme — nothing useful to say about them, so they say nothing.

## Rules for adding a group

- **Keep it between 2 and 70 cards.** `synergies.test.ts` enforces this. A group
  matching a sixth of the catalogue is a category, not a combo hint, and it makes
  the deck builder glow on everything.
- **Never group on a generic combat tag.** `melee`, `ranged`, `armored`, `large`,
  `fast`, `slow`, `magic`, `flying` are all far too broad, and `CardDetailModal`
  already renders them as trait chips. `forgotten` is a 350-card catch-all — not
  a theme.
- **Prefer a tag that already exists** over adding one to `cards.json`. Card tags
  are also read by `weeklyChallenge.ts`, `quests.ts` and `chronicle.ts`, so a new
  tag widens those pools too.
- **Write `desc` as advice, not flavour.** It is shown to the player in the card
  detail modal and should say *why* the cards want to be together.
- Update the table above when you add or resize a group.

## Where it surfaces

| Surface | Shows |
|---|---|
| `components/cards/SynergyBadges.tsx` | Up to 2 group icons plus a `⚡N` deck-pairing count. Icon-only — labels are in the tooltip. |
| `components/cards/CardTile.tsx` | Renders the badges in the corner of the card art. `deckMatches` prop is deck-builder only. |
| `components/cards/CardDetailModal.tsx` | Collapsible SYNERGY row: every pairing and every group, in plain English. |
| `components/cards/DeckBuilder.tsx` | Live scoring against the deck — see below. |

In the deck builder the two tiers get two different visuals, because at 92%
group coverage a single "shares a group" glow would light up most of the
browser:

| Signal | Visual |
|---|---|
| Shares a group with the deck | `collection-cell--synergy` — dim gold border |
| Directly pairs with a deck card | `collection-cell--combo` — bright border and glow, plus `⚡N` on the tile |
| Either | Counts toward the "⚡ Synergy" sort, which floats the best fits to the top |

`⚡N` is a count of direct pairings only, never of shared groups — it has to
mean one thing to the player.

Scoring a whole browser is done through `buildDeckProfile` once per deck change,
then `getDeckSynergy` per card. Don't call `getDeckSynergy` with a freshly built
profile inside a loop.
