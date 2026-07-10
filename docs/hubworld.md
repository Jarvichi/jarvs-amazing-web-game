# Hub World — Data Schemas & Agent Reference

> This document is the authoritative reference for hub world JSON authoring.
> Read it before editing `web/src/data/hub/config.json`,
> `web/src/data/hub/questDefs.json`, or any hub TypeScript files.

---

## §1 — File Map

| File | Owns | TypeScript exports |
|---|---|---|
| `web/src/data/hub/config.json` | Map geometry, buildings, doors, NPCs, exterior decor, interiors, windows, interactables | parsed by `loader.ts` |
| `web/src/data/hub/questDefs.json` | Quests, pickup items, blocked paths, inn rumours, friendship dialogue, dialogue trees, relationship dialogue | parsed by `loader.ts` and `questDefs.ts` |
| `web/src/data/hub/loader.ts` | Parses both JSON files; exports all map/NPC/item/path data | `MAP_W`, `MAP_H`, `AVATAR_START`, `HUB_AREAS`, `HUB_STREET_TILES`, `HUB_BUILDINGS`, `HUB_DOORS`, `HUB_INTERIORS`, `EXTERIOR_DECOR`, `HUB_NPCS`, `EXTERIOR_NPCS`, `INTERIOR_NPCS`, `HUB_PICKUP_ITEMS`, `HUB_BLOCKED_PATHS`, `HUB_LOCKED_DOORS`, … |
| `web/src/data/hub/questDefs.ts` | Parses `questDefs.json`; exports quest definitions and dialogue | `HUB_QUEST_DEFS`, `INN_RUMOURS`, `FRIENDSHIP_DIALOGUE` |
| `web/src/game/hub/quests.ts` | Quest progress/status persistence (localStorage) | `getQuestState`, `setQuestStatus`, `incrementQuestProgress`, `getQuestProgress`, `resetQuest` |
| `web/src/game/hub/pickups.ts` | Pickup state persistence (localStorage) | `getPickedUpIds`, `markPickedUp`, `isPickedUp`, `unmarkPickedUp` |
| `web/src/game/hub/friendship.ts` | NPC friendship XP/level persistence (localStorage) — signed ladder, see §7f | `getFriendshipLevel`, `addFriendshipXp`, `getFriendshipData`, `MAX_FRIENDSHIP_LEVEL` |
| `web/src/game/hub/reputation.ts` | Per-town reputation + per-building upgrade levels (localStorage) — see §10 | `getTownReputation`, `getUpgradeLevel`, `nextUpgrade`, `purchaseUpgrade`, `getUnlockedServices`, `hasTownService` |
| `web/src/data/hub/buildingUpgrades.json` / `.ts` | Shared upgrade tracks keyed by building *kind* (costs, benefits, services, decor) — see §10 | `getUpgradeTrack`, `getReputationTier`, `REPUTATION_TIERS` |
| `web/src/game/hub/relationships.ts` | NPC relationship-track (ally/rival/romance) persistence (localStorage) — see §7c | `getRelationship`, `getRelationshipTrack`, `getRelationshipLevel`, `addRelationshipPoints`, `grantRelationshipWithRivalry`, `relationshipProgress` |
| `web/src/game/hub/dialogueFlags.ts` | Branching-dialogue flag + "seen" branch persistence (localStorage) — see §7b | `setDialogueFlag`, `hasDialogueFlag`, `getDialogueFlags`, `markNodeSeen`, `hasNodeSeen` |
| `web/src/game/hub/innConvos.ts` | Inn conversation tracking (localStorage) | `getHeardConvoIds`, `markConvoHeard`, `isConvoHeard` |
| `web/src/game/hub/interactables.ts` | Interactable grant + moved-position persistence (localStorage) | `interactableStoreKey`, `isInteractableGranted`, `markInteractableGranted`, `getInteractableMoves`, `setInteractableMove` |
| `web/src/game/hub/animals.ts` | Pure animal logic — `ANIMAL_SPECS` registry (per-type data), spawn maths, tint resolution | `ANIMAL_SPECS`, `computeProceduralCounts`, `resolveVariantTint`, `ANIMAL_CAPS`, `TINT_PALETTES` |
| `web/src/components/hub/hubAnimals.ts` | PixiJS animal manager — spawns & ticks all animal types | `createAnimalSystem` |
| `web/src/components/hub/HubTownCanvas.tsx` | PixiJS canvas — rendering, pathfinding, walk, interactions | — |
| `web/src/components/hub/HubWorld.tsx` | React orchestrator — quest flow, dialogue, state | — |
| `web/src/game/hub/journal.ts` | Discovery store for the Town Journal — met NPCs, seen animal species/variants, seen named areas (localStorage) — see §15 | `recordNpcMet`, `hasMetNpc`, `getMetNpcIds`, `recordAnimalSeen`, `hasSeenAnimal`, `getSeenAnimalVariants`, `getSeenAnimalTypes`, `recordAreaSeen`, `hasSeenArea`, `getSeenAreaKeys` |
| `web/src/components/hub/TownJournal.tsx` | Journal UI — Animals / People / Places tabs with completion % — see §15 | `TownJournal` |
| `web/src/game/hub/pet.ts` | Player's adopted follower-pet persistence (localStorage) — see §8 | `getActivePet`, `hasActivePet`, `adoptPet`, `renamePet`, `dismissPet` |
| `web/src/components/hub/PetModal.tsx` | Pet adoption / rename / swap / dismiss UI — see §8 | `PetModal` |
| `web/src/data/hubItems.json` | Hub-item catalog: materials (chicken feed, eggs, fish, trade goods) and unique tools (fishing rod) — see §16 | consumed by `itemStore.ts` |
| `web/src/game/itemStore.ts` (hub-item section) | Hub-item inventory persistence (localStorage, type `'hub-item'`) — see §16 | `addHubItem`, `removeHubItem`, `getHubItemCount`, `hasHubItem`, `getHubItems`, `getHubItemCatalogEntry` |
| `web/src/game/hub/questItems.ts` | Held-quest-item id helpers (`quest:<questId>:<stepKey>`) — see §16 | `questItemId`, `isQuestItemId`, `questIdFromItemId` |
| `web/src/game/hub/digs.ts` | Once-per-day dig-spot persistence (localStorage) — see §7 `dig` reaction, §16 | `canDigToday`, `recordDig` |
| `web/src/components/hub/HubInventoryModal.tsx` | 🎒 Hub Inventory UI — held quest items, materials & tools, pet accessories — see §16 | `HubInventoryModal` |
| `web/src/game/hub/talkCooldown.ts` | Once-per-day "Make conversation" persistence (localStorage) — see §7d | `canTalkToday`, `recordTalk` |
| `web/src/game/hub/forages.ts` | Once-per-day forage-spot persistence (localStorage) — see §7 `forage` reaction | `canForageToday`, `recordForage` |

---

## §2 — Blocked Paths

Blocked paths are quest-gated obstructions in the exterior hub world. They are
defined in the `blockedPaths` array at the top level of `questDefs.json`.

### Full schema

```json
{
  "blockedPaths": [
    {
      "id": "east-road-block",
      "blockedTiles": [[45, 20], [46, 20], [47, 20]],
      "questId": "some-quest-id",
      "blocked": {
        "decor": [
          { "tx": 46, "ty": 20, "tileId": "logHorizontal" }
        ],
        "npcs": [
          {
            "id": "road-guard-east",
            "sprite": "hub-npc-guard",
            "tx": 48,
            "ty": 20,
            "proximityDialogue": [
              { "atDistance": 10, "text": "Who goes there?" },
              { "atDistance": 5,  "text": "None shall pass!" }
            ],
            "tapDialogue": "We've been told to only let you pass if you know the password."
          }
        ]
      },
      "cleared": {
        "decor": [
          { "tx": 46, "ty": 24, "tileId": "logHorizontal" }
        ],
        "npcs": [
          {
            "id": "road-guard-east-cleared",
            "sprite": "hub-npc-guard",
            "tx": 49,
            "ty": 20,
            "tapDialogue": "Safe travels, Commander."
          }
        ]
      }
    }
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✓ | Unique identifier for this block. Only used internally for tracking. |
| `blockedTiles` | `[number, number][]` | ✓ | Array of `[tx, ty]` hub tile coordinates removed from pathfinding while blocked. **Must already exist in `config.json` streets** — they become walkable again on clear. |
| `questId` | `string` | one of `questId`/`unlockedByInteractable` | Quest ID from the `quests` array in `questDefs.json`. The path clears the moment this quest reaches `completed` status (checked live every frame, so no reload needed). |
| `unlockedByInteractable` | `string` | one of `questId`/`unlockedByInteractable` | Alternative gate for **hidden-area reveals** (see §7's secret interactables): the `id` of a `config.json` interactable elsewhere in town. The path clears the moment that interactable's `giveItem` reaction has been granted (checked via `isInteractableGranted`/`interactableStoreKey` from `interactables.ts` — the same one-time-grant persistence secrets already use), live, no reload. Use this instead of authoring a throwaway quest just to gate a reveal. |
| `blocked` | `BlockedPathState` | ✓ | Visual state while blocked. |
| `cleared` | `BlockedPathState` | ✓ | Visual state once cleared. Can be empty `{}` if nothing changes visually. |

#### `BlockedPathState` fields

| Field | Type | Description |
|---|---|---|
| `decor` | `DecorEntry[]` | Decor tiles to render in this state. Same format as `config.json` `exteriorDecor`. |
| `npcs` | `BlockedPathNpc[]` | NPCs visible only in this state. |

#### `DecorEntry` fields

| Field | Type | Description |
|---|---|---|
| `tx`, `ty` | `number` | Tile position. |
| `tileId` | `string` | Constant name from `web/src/data/tiles/baseChipIndex.ts` (e.g. `"logHorizontal"`). **Not a raw integer.** |
| `zlayer` | `"below-avatar"` \| omit | Omit for standard Y-sorted rendering. Use `"below-avatar"` for flat ground items that should render beneath the avatar sprite. |

#### `BlockedPathNpc` fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique string. Not matched to `config.json` NPCs — blocking NPCs are independent. |
| `sprite` | `string` | SVG filename without `.svg` from `web/public/sprites/` (e.g. `"hub-npc-guard"`). |
| `tx`, `ty` | `number` | Tile position. |
| `proximityDialogue` | `{atDistance: number, text: string}[]` | Optional distance-triggered speech bubbles. Uses Chebyshev distance (same as name-tag visibility). Shows the matching entry with the **smallest `atDistance` that the player has entered**. Example: thresholds `[10, 5]` — avatar at distance 8 shows the `atDistance: 10` text; at distance 3 shows the `atDistance: 5` text. Omit for cleared NPCs. |
| `tapDialogue` | `string` | Optional. Shown in the dialogue modal when the NPC is tapped. |

### Proximity dialogue logic

```
given: proximityDialogue = [{atDistance: 10, text: "A"}, {atDistance: 5, text: "B"}]
avatar at tile distance 12 → no bubble (12 is not ≤ any threshold)
avatar at tile distance 8  → show "A"  (8 ≤ 10, but 8 > 5)
avatar at tile distance 3  → show "B"  (3 ≤ 5; pick smallest matching atDistance)
```

---

## §3 — Pickup Items

Pickup items are collectible objects placed in the hub world. They live in the
`pickupItems` array at the top level of `questDefs.json`.

### Full schema

```json
{
  "pickupItems": [
    {
      "id": "pendant-1",
      "tx": 30,
      "ty": 25,
      "tileId": "pendant",
      "questId": "lost-pendant",
      "requireTouch": false
    },
    {
      "id": "deep-forest-gem",
      "tx": 55,
      "ty": 40,
      "tileId": "gemBlue",
      "questId": "gem-hunt",
      "requireTouch": true
    },
    {
      "id": "tome-2",
      "tx": 44,
      "ty": 12,
      "tileId": "bookClosed",
      "building": "trading-post",
      "questId": "scholars-anthology",
      "chain": "ancient-tome-1"
    }
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✓ | Unique identifier. Referenced by quest step `pickupIds` arrays. |
| `tx`, `ty` | `number` | ✓ | Tile position. For exterior items, absolute hub coords. For interior items, coords within the interior room grid. |
| `tileId` | `string` | ✓ | Constant name from `web/src/data/tiles/baseChipIndex.ts`. |
| `building` | `string` | | Building ID (matches `config.json` building `id`). Omit for exterior items; required for interior items. |
| `questId` | `string` | | If set, the item only appears while this quest is `active`. |
| `chain` | `string` | | Item ID that must be collected before this item becomes visible. Used for chained collection quests. |
| `requireTouch` | `boolean` | | Default `false`. When `true`, the item cannot be tapped from a distance — it is collected automatically when the avatar walks onto the exact tile. Use this for items placed in locations only reachable after clearing a blocked path. |

---

## §4 — Tile ID Keys

All `tileId` fields in both JSON files are **constant names** (strings) from
`web/src/data/tiles/baseChipIndex.ts`, not raw integers. The loader calls
`resolveTileId(key)` to convert them.

```ts
// baseChipIndex.ts (excerpt)
export const BASE_CHIP_TILES = {
  lightGrass: 0,
  logHorizontal: 42,
  pendant: 87,
  gemBlue: 95,
  bookClosed: 110,
  // ...
}
```

Using the string key means you do not need to know the numeric ID and the data
remains readable.

---

## §5 — Sprite Names

NPC `sprite` values are SVG filenames in `web/public/sprites/` **without the
`.svg` extension**.

```
"sprite": "hub-npc-guard"
  → loads /sprites/hub-npc-guard.svg
```

Existing hub NPC sprites: `hub-npc-elder`, `hub-npc-merchant`, `hub-npc-scholar`,
`hub-npc-fisherman`, `hub-npc-guard`, `hub-npc-herald`, and others in
`web/public/sprites/hub-npc-*.svg`.

---

## §6 — Authoring Checklist: New Blocked Path

1. **Define the quest** it gates in `questDefs.json` `quests` array (if not already done).
2. **Identify the tiles** to block — they must already appear in `config.json` `streets`. If the tiles are not in streets, add them there first.
3. **Choose decor** for the blocked state — look up the constant name in `baseChipIndex.ts`.
4. **Choose NPC(s)** for the blocked state if desired. Pick a sprite from `web/public/sprites/hub-npc-*.svg`. Set `proximityDialogue` thresholds (10 tiles for a first notice, 5 tiles for the warning is a sensible default).
5. **Define the cleared state** — move the decor to its post-clearing position, change or remove NPCs.
6. **Add the entry** to `blockedPaths` in `questDefs.json`.
7. **Run `npm run build`** from `web/` — TypeScript will catch any malformed tile ID or missing field.
8. **Verify in-game**: confirm the avatar cannot path through the blocked tiles, the NPC speech bubbles appear at the right distances, and tapping the NPC shows the tap dialogue.

---

## §7 — Interactables (tap-reactive decor & scenery)

Interactables make decor react to a click/tap: show dialogue, open a screen,
give an inventory item (once), offer a quest, or move to another tile. They
are defined in the top-level `interactables` array of a location's
`config.json` and work in both the exterior world and building interiors.

### Full schema

```jsonc
{
  "interactables": [
    {
      "id": "notice-board",            // unique per location
      "tx": 49, "ty": 21,              // anchor tile (top-left of footprint)
      "building": "inn-building",      // optional — interior id; omit for exterior
      "decor": [                       // optional — OWNED tiles (rendered + movable)
        { "dx": 0, "dy": 0, "tileId": "messageBoardTopLeft", "zlayer": "solid" }
      ],
      "hitRect": { "w": 2, "h": 2 },   // optional — invisible tap area at the anchor
      "indicator": { "condition": "unread-news", "dx": 0, "dy": 0 },  // optional '!'
      "reactions": [                   // ordered; executed sequentially per tap
        { "type": "screen", "screen": "news" }
      ]
    }
  ]
}
```

An interactable either **owns its decor** (`decor`, offsets relative to the
anchor — required for `move` reactions, since the canvas repositions those
sprites as a unit) or is a **pure hit area** (`hitRect`) laid invisibly over
existing static `exteriorDecor`/interior decor. When converting existing
scenery to owned decor, **remove the duplicate tiles** from `exteriorDecor`.
If neither `hitRect` nor `decor` is given, the hit area defaults to the decor
bounds, else a single tile.

### Reaction types

| Type | Fields | Behaviour |
|---|---|---|
| `dialogue` | `speakerName?`, `text` (string or string[]) | Shows the dialogue modal. A string[] cycles one entry per tap. |
| `screen` | `screen` | Opens a screen via the same routing as NPC `screen` (e.g. `news`, `shop`, `interior:<id>`, `bounty-board`, `town-upgrades`, `adopt-pet` — see §8, minigame ids). |
| `giveItem` | `collectible?`, `consumables?`, `crystals?`, `hubItem?`, `message?`, `alreadyGrantedText?` | One-time grant (persisted). Re-taps show `alreadyGrantedText` if set. Reward shapes match treasure rewards. `collectible.lore?` (optional flavor text) is stored on the item and already surfaced by `HomeShelf`/`ItemFoundScreen` — no extra wiring needed for lore notes. `hubItem?: { itemId, count? }` grants a hub-item (`hubItems.json`, §16) via `addHubItem` — the only way a secret/discovery interactable can hand over a `'material'` item, e.g. a favorite gift (§7d). |
| `quest` | `questId`, `speakerName?` | Offers the quest with Accept / Not now. The quest's `giverNpcId` in `questDefs.json` **must equal the interactable's id**. Honours prerequisites and the 2-active-quest cap. |
| `move` | `to: {tx, ty}`, `message?` | Moves the owned decor to the target tile, live and persisted across reloads. Requires owned `decor`. |
| `buy` | `slotIndex` | Sells the interactable's building's Nth daily-rotating shop-stock item (`getTodaysShopItems`, `SHOP_TRADER_REGISTRY`). Shares `DailyShopState` with `ShopScreen`, so both draw down the same stock. Requires `building`. |
| `buyPack` | — | Crystal-pack purchase flow (delegates to `onBuyCrystalPack`). Requires `building`. |
| `buyHubItem` | `itemId`, `price`, `currency?`, `speakerName?`, `prerequisite?`, `lockedText?` | Always-available hub-item purchase (no daily rotation) — see §16. `itemId` must exist in `hubItems.json`; `currency` is `'crystals'` (default) or `'tickets'`. Unique items (e.g. the fishing rod) re-offer as "already owned" once bought. `speakerName` overrides the building-NPC speaker (useful for exterior stalls). `prerequisite` (§14 syntax, including `reputation:<tier>`) gates the offer — unmet shows `lockedText` (or a default refusal) instead. |
| `dig` | `requiresItemId?`, `nightOnly?`, `weatherOnly?`, `lootTable?` | Once-per-day dig spot (see §16), gated on holding the tool hub-item (default `'spade'`). `nightOnly: true` makes it a **dark hollow** that refuses by day; `weatherOnly` (e.g. `"rain"`) makes it refuse unless the town's resolved weather (§12) matches — used by **rain barrels**. `lootTable: 'earth'` (default) rolls 50% worms (+2 fish bait) / 30% crystals (10–25) / 20% a dug-up trinket; `'hollow'` rolls 50% glowcap mushroom / 25% crystals (15–35) / 25% a firefly; `'rain'` always yields 1 rainwater; `'fog'` always yields 1 grave moss. Cooldown persists per spot per real day in `jarv_hub_digs` (`web/src/game/hub/digs.ts`). Pair with a `mediumDirt` decor tile (`zlayer: "below"`) for an earth patch, or `barrel` for a rain barrel. |
| `forage` | — | Once-per-day forage spot, no fields. Unlike `dig`, no tool/night/weather gating — meant to overlay an ordinary tree/bush/flower `exteriorDecor` tile (no owned decor of its own) so any existing scenery can become forageable. Rolls 45% 1 wild berries / 35% crystals (5–15) / 20% a rare four-leaf-clover collectible. Cooldown persists per spot per real day in `jarv_hub_forages` (`web/src/game/hub/forages.ts`), same key convention as `dig`. |

Reactions run in order; `dialogue` (and `message`-bearing reactions) chain the
remainder through the dialogue's close. Conventions: at most one `screen` or
`quest` reaction per interactable, placed last; don't overlap two
interactables' solid interior decor on the same tile.

### Indicator conditions

`indicator.condition` names a boolean computed by `HubWorld`:

| Condition | True when |
|---|---|
| `unread-news` | `getUnreadCount()` (news store) is > 0 at hub load |

The indicator is a bobbing yellow `!` above the footprint (offset by
`dx`/`dy` tiles), identical in style to NPC quest indicators.

### Persistence

localStorage keys, entries keyed `<townName>:<interactableId>`:

| Key | Holds |
|---|---|
| `jarv_hub_interactable_grants` | ids whose `giveItem` already fired |
| `jarv_hub_interactable_moves` | persisted `{tx, ty}` position overrides |

### Authoring checklist

1. Pick a unique `id` within the location.
2. Owned decor or hit area? Owned if it should ever move; hit area to make existing static scenery tappable.
3. Look up `tileId` constants in `baseChipIndex.ts`; set `building` for interiors.
4. For `quest` reactions, set the quest's `giverNpcId` to the interactable id.
5. Run `npm run test` (loader tests parse all configs) and `npm run build`.
6. Verify in-game: tap fires the reactions, tap does not also walk the avatar, indicator shows/clears, moves persist after reload.

### Authoring checklist: new secret / dig-spot

A "secret" isn't a distinct schema — it's an ordinary interactable authored
with **no owned `decor`** (see "Full schema" above: with neither `decor` nor
`hitRect` given, the hit area defaults to a single invisible tile), so it's
fully tappable while rendering nothing. No indicator either — secrets should
be genuinely non-obvious, not flagged with the usual `!`.

1. Pick a tile that's walkable-adjacent but not an obvious landmark (a gap
   between buildings, a pond edge, a quiet corner).
2. Add an interactable entry with **no `decor`** and **no `indicator`**: a
   `dialogue` reaction for discovery flavor, then a `giveItem` reaction
   granting a collectible. Use `collectible.lore` for a lore note's full text.
   To hide a **secret gift item** instead (§7d — a favorite-gift NPC's
   `favoriteGiftItemId`), use `giveItem`'s `hubItem: { itemId, count? }` field
   so the discovery grants a `'material'` hub-item the player can then give
   away, rather than a `collectible`. Live examples: `gearford-secret-pressed-flower`,
   `thornwood-secret-river-glass`, `saltmere-secret-tin-whistle`.
3. *(Optional — hidden-area reveal)* Pair this secret with a hidden area: add
   a `blockedPaths` entry in the town's `questDefs.json` (§2) whose
   `unlockedByInteractable` is this secret's `id`. The blocked/cleared decor
   conceals/reveals the area; put a normal `giveItem` interactable on the
   newly-walkable tile for the actual reward, since the tile is impassable
   (and thus untappable) until the path clears.
4. Run `npm run test` and `npm run build`.
5. Verify in-game: the secret is invisible but tappable at its tile, the
   reward grants once (re-tapping does nothing further), the lore text reads
   correctly wherever the item is displayed, and — if paired with a hidden
   area — that area opens live (no reload) the moment the secret is found,
   and all of it persists across a reload.

### Authoring checklist: new forage spot

Unlike a secret, a forage spot should be **visible and obvious** — it overlays
an *existing* `exteriorDecor` tile (a tree, bush, flower, or other plant
scenery already in the town), so no owned `decor` or new art is needed.

1. Pick an existing tree/bush/flower `exteriorDecor` entry's `tx`/`ty` (grep
   the town's `exteriorDecor` array for a `tileId` containing `tree`, `bush`,
   `shrub`, or `flower`) that isn't already occupied by another interactable,
   NPC, or animal.
2. Add an interactable entry at that same `tx`/`ty` with **no `decor`**: a
   `dialogue` reaction for flavor, then a `{ "type": "forage" }` reaction (no
   fields). Live examples: `ravenwatch-forage-bush-1`, `ravenwatch-forage-tree-1`,
   `ravenwatch-forage-flower-1`/`-2`.
3. Run `npm run test` and `npm run build`.
4. Verify by reading the flow: the interactable sits directly on top of
   already-rendered decor (no visual change needed), tapping it once a day
   grants wild berries / crystals / a four-leaf clover, and re-tapping the
   same day shows the "already foraged" line instead.

---

## §7b — Branching Dialogue Trees

Reusable multi-choice NPC conversations that branch to different endings.
Authored in `questDefs.json` under a top-level `dialogues` array and attached to
an NPC via `dialogueTree` (the id of the tree). When such an NPC is tapped and has
no higher-priority interaction (quest offer/completion, screen, friendship-tier
line), `HubWorld.tsx` walks the tree instead of the linear `dialogue` cycle. The
tree's entry (root) node also gets Talk/Give (§7d) inserted ahead of the
node's exit — its own authored `end`-effect "leave" choice if it has one, or
else a generic trailing "Farewell" — so there is always exactly one exit,
last; later nodes reached by picking a choice do not get Talk/Give at all.

Types live in `web/src/data/hub/questDefs.ts`; the walker (`runDialogueNode` /
`applyChoice`) lives in `web/src/components/hub/HubWorld.tsx`. Reuses the existing
`HubDialogue` UI (renders `choices`), `tryOfferQuest`, and `addFriendshipXp`.

### Full schema

```jsonc
// questDefs.json (top level, alongside "quests")
"dialogues": [
  {
    "id": "scholar-chat",          // referenced by HubNpc.dialogueTree
    "npcId": "scholar",            // documentation only
    "start": "greet",              // id of the first node in `nodes`
    "nodes": {
      "greet": {
        "text": "What's on your mind?",
        "choices": [
          { "label": "Tell me about the Fracture.", "next": "lore" },
          { "label": "Help nearby?",  "next": "errand" },
          { "label": "Just saying hi.",
            "effects": [{ "type": "friendship", "npcId": "scholar", "xp": 5 },
                        { "type": "flag", "flag": "scholar-greeted" }],
            "next": "hello" }
        ]
      },
      "lore":   { "text": "…", "choices": [ { "label": "Thanks.", "effects": [{ "type": "end" }] } ] },
      "errand": { "text": "…", "choices": [ { "label": "I'll help.", "effects": [{ "type": "quest", "questId": "feed-the-stray" }] } ] },
      "hello":  { "text": "…", "choices": [
                    { "label": "A question…", "requireFlag": "scholar-greeted", "next": "greet" },
                    { "label": "Farewell.",   "effects": [{ "type": "end" }] } ] }
    }
  }
]
```

Then on the NPC (in `config.json`): `"dialogueTree": "scholar-chat"` (keep a
`dialogue` array as a fallback line).

### Field reference

#### `DialogueNode`
| Field | Type | Notes |
|---|---|---|
| `text` | string | The line shown. |
| `speakerName` | string? | Overrides the NPC name for this node. |
| `choices` | `DialogueChoiceDef[]`? | Absent/empty → a single **OK** button closes. |

#### `DialogueChoiceDef`
| Field | Type | Notes |
|---|---|---|
| `label` | string | Button text. |
| `next` | string? | Node id to advance to **after** effects run. |
| `effects` | `DialogueEffect[]`? | Run in order before navigation. |
| `requireFlag` | string? | Choice only shown if the flag is set. |
| `hideIfFlag` | string? | Choice hidden once the flag is set. |
| `requireFestival` | string? | Choice only shown while that festival is active (§14 festival ids, e.g. `"midsummer"`). |
| `requireWeather` | string? | Choice only shown while the town's resolved weather (§12) matches (`"clear"`/`"rain"`/`"snow"`/`"fog"`). Weather is date/season-driven — for QA, force `"weather": {"type": "snow"}` in the town config, or use Millhaven (rains year-round). |

#### `DialogueEffect` types
| `type` | Fields | Behaviour |
|---|---|---|
| `flag` | `flag` | Persist a named dialogue flag. |
| `friendship` | `npcId?`, `xp` | Grant friendship XP (defaults to the speaking NPC). |
| `relationship` | `npcId?`, `track`, `points` | Add points to a relationship track (`ally`/`rival`/`romance`) — defaults to the speaking NPC. See §7c. |
| `quest` | `questId` | Offer that quest (Accept / Not now). Resolves the quest's real `giverNpcId`. **Terminates** the walk. |
| `tradeHubItem` | `wantItemId?`, `wantCount?`, `wantItems?`, `giveCrystals?`, `giveHubItem?`, `giveCollectible?`, `giveFriendship?`, `giveRelationship?`, `missingText`, `successText` | Repeatable barter — see §16. Takes `wantCount` (default 1) of a hub-item — or every entry of `wantItems: [{itemId, count?}]` for multi-item recipes (all-or-nothing, takes precedence over `wantItemId`) — and grants the `give*` rewards (`giveFriendship: {npcId?, xp}` and `giveRelationship: {npcId?, track, points}` default to the speaking NPC), showing `successText` (then advancing to `next` on close, so a sell menu can loop). If the player holds too few of anything, shows `missingText` and **terminates** the walk with no state change. Must be the **only/last** effect on its choice (it terminates the walk either way). |
| `end` | — | End the conversation. |

If a choice has neither a terminating effect (`quest`/`end`) nor `next`, the
conversation closes.

### Persistence

`web/src/game/hub/dialogueFlags.ts` (localStorage key `jarv_hub_dialogue_flags`):

| Export | Purpose |
|---|---|
| `setDialogueFlag` / `hasDialogueFlag` / `getDialogueFlags` | Named flags set by `flag` effects and read by `requireFlag` / `hideIfFlag`. |
| `markNodeSeen` / `hasNodeSeen` | "Seen" branch tracking — every visited node is recorded as `seen:<treeId>:<nodeId>`, usable as a flag. |

### Authoring checklist

1. Add a tree to the location's `questDefs.json` `dialogues` array with a unique `id` and a `start` node.
2. Give each branch a clear ending (`end`, a `quest` offer, or a node with an OK button).
3. For a `quest` effect, ensure the `questId` exists (its real giver is resolved automatically).
4. Attach `"dialogueTree": "<id>"` to the NPC in `config.json`; keep a `dialogue` fallback line.
5. Run `npm run test` (loader tests parse all configs) and `npm run build`.
6. Verify in-game: tapping the NPC branches to different endings, friendship XP / quest offers fire, and flag-gated choices reflect persisted state after reload.

---

## §7c — Relationship Tracks (ally / rival / romance)

A second relationship layer **on top of** flat friendship (§7b friendship is
untouched). Each NPC accumulates points on three independent tracks — `ally`,
`rival`, `romance` — and the track with the most points becomes the NPC's
**dominant track**, whose point total maps to a 0–4 level via the same ladder as
friendship (`[0, 10, 25, 50, 100]`). State persists in `localStorage`.

Logic: `web/src/game/hub/relationships.ts`. UI: per-NPC `RelationshipView` modal
opened from the Town Directory ("Where is…?") row buttons.

### Persistence — `web/src/game/hub/relationships.ts` (key `jarv_hub_relationships`)

| Export | Purpose |
|---|---|
| `getRelationship(npcId)` | `{ track, level, points }` entry (default empty). |
| `getRelationshipTrack(npcId)` / `getRelationshipLevel(npcId)` | Dominant track / its level. |
| `addRelationshipPoints(npcId, track, points)` | Add points, recompute dominant track + level, persist. |
| `relationshipProgress(entry)` / `MAX_RELATIONSHIP_LEVEL` | Pure helpers for the view UI. |

### Advancing a track

1. **Dialogue choices** — a `relationship` `DialogueEffect` in a dialogue tree
   (§7b). This is the primary way the player *steers* an NPC:
   ```jsonc
   { "label": "As a worthy rival.",
     "effects": [{ "type": "relationship", "npcId": "scholar", "track": "rival", "points": 4 }] }
   ```
2. **Quest / gift rewards** — a `relationship` block on a quest `reward`
   (parallels `friendship`):
   ```jsonc
   "reward": { "crystals": 60, "relationship": { "scholar": { "track": "ally", "points": 10 } } }
   ```

### Track-gated content

A quest `prerequisite` (or interactable quest gate) may require a track + level:

```
"prerequisite": "relationship:<npcId>:<track>:<level>"   // e.g. relationship:scholar:ally:2
```

True only when the NPC's **dominant** track equals `<track>` and its level
`>= <level>`. Combine with `|` like other prerequisites (e.g.
`quest:foo|relationship:scholar:rival:2`).

### Track-specific greeting — `relationshipDialogue`

A top-level block in `questDefs.json` (parallels `friendshipDialogue`), keyed
`npcId → track → levelString → line`. Shown when that NPC's dominant track is
active at/under the current level, taking precedence over the friendship-tier
greeting:

```jsonc
"relationshipDialogue": {
  "merchant": {
    "ally":  { "2": "For a trusted ally, the best stock comes out from under the counter." },
    "rival": { "2": "Every bargain with you is a duel. I won't blink first." }
  }
}
```

> **Do not** author `relationshipDialogue` for an NPC that also has a
> `dialogueTree` — the greeting would shadow the tree (the player's steering
> path). `HubWorld.tsx` guards against this, so steer tree-NPCs via tree choices
> and use `relationshipDialogue` only on linear-dialogue NPCs.

### Authoring checklist

1. To let the player steer an NPC: add `relationship` effects to its dialogue
   tree choices (§7b), or grant points via quest `reward.relationship`.
2. Gate follow-up quests with `prerequisite: "relationship:<npc>:<track>:<level>"`.
3. Optionally add `relationshipDialogue` for **linear-dialogue** NPCs only.
4. Run `npm run test` + `npm run build`; verify in-game that steering changes the
   track in the Town Directory → Relationship view, gated quests appear, and
   state survives a reload.

### Rivalry (`HubNpc.dislikes`)

Some NPCs dislike each other — befriending one sours the player's standing
with anyone in the same town who dislikes them. This needs **no new points
concept**: it reuses the existing `rival` track. Every relationship grant
(in `HubWorld.tsx` — quests, dialogue-tree effects, Talk/Give — and in
`bounties.ts`, §7e) goes through the exported
`grantRelationshipWithRivalry(npcId, track, points, townNpcs)` helper in
`web/src/game/hub/relationships.ts` (not the raw `addRelationshipPoints` —
that stays an internal building block). Whenever an `ally`/`romance` grant
pushes that NPC's dominant track up a **level**, every NPC in the same town
whose `dislikes` array contains that NPC's id gets `RIVALRY_POINTS` (4) added
to their own `rival` track. `rival`-track grants never trigger further
rivalry (no chains).

- `HubNpc.dislikes?: string[]` — ids of other **same-town** NPCs this NPC
  dislikes. Scoped to one town by design — `dislikes` is checked against
  `locationData.HUB_NPCS`, not a cross-town registry.
- The reactive line needs no new plumbing — it's an ordinary
  `relationshipDialogue` entry for the disliking NPC's `rival` tier (above).
  It fires automatically the next time that NPC is talked to, exactly like any
  other relationship-tier greeting.
- Demo pair (Ravenwatch): `npc_1781727321393` ("The Wanderer") dislikes
  `npc_1781629843466` ("James"). Both are plain flavor-only NPCs, so
  befriending James via §7d's Talk/Give raises the Wanderer's `rival` track;
  once it reaches level 1 the Wanderer's `relationshipDialogue.rival["1"]`
  line fires.

#### Authoring checklist: new rivalry pair

1. Add `"dislikes": ["<other-npc-id>"]` to the disliking NPC in its town
   `config.json`.
2. Author a `relationshipDialogue` entry for that NPC's `rival` tier (this
   doc's §7c schema, above) in the same town's `questDefs.json` — skip this if
   the NPC has a `dialogueTree` (relationshipDialogue is shadowed either way).
3. Run `npm run test` + `npm run build`.
4. Verify by reading the flow through: repeatedly advance the liked NPC's
   `ally`/`romance` track (via quests, dialogue-tree effects, or §7d Talk/Give)
   until it levels up at least `10 / RIVALRY_POINTS` times (3, at the default
   4 pts/level-up) to cross the disliking NPC's rival level 1 threshold, then
   confirm the disliking NPC's next tap shows the grudge line.

---

## §7d — Generic Talk / Give (every named NPC)

Every named NPC gets two always-available dialogue choices — no authoring
required — so the Town Directory's 💗 Relationship button has a real way to
move even for the ~5 in 6 NPCs with no `dialogueTree` (§7b) and no active
quest. Talk/Give is inserted into every **top-level** NPC dialogue (the modal
shown as the direct result of a tap) — after any screen-enter choice, quest
offer/turn-in choice, dialogue-tree root node's authored choices, or a
relationship/friendship flavor line — so it always coexists with an NPC's
other content in the same modal. Follow-up dialogueEvents reached by tapping
an earlier choice — a dialogue tree's later nodes, the gift-item picker, a
quest offer's Accept/Not-now decision reached mid-tree, or the reward text
shown after a quest completes — do **not** get Talk/Give re-appended, since
the player already made their choice for this interaction. Two exceptions
keep the old plain-text/auto-dismiss behavior and never gain Talk/Give: a
bounty-report tick (§7e) and Innkeeper Rosie's inn-rumour reveal, since both
are automatic incidental side effects of a tap rather than a real
conversation turn.

The dialogue always ends with **exactly one** trailing exit choice. Where the
NPC's own flow already supplies a decline/exit — a quest offer's "Not now",
or a dialogue tree root node's authored `end`-effect "leave" choice — that
existing choice is reused as the single trailing exit, and only the
🗣️/🎁 options are inserted ahead of it (`buildTalkGiveOptions` in
`HubWorld.tsx`). Only when nothing already provides an exit does the closing
section add its own generic "Farewell" (`buildTalkGiveChoices`, a thin
wrapper around `buildTalkGiveOptions` that appends Farewell).

- **🗣️ Make conversation** — grants a small flat friendship XP + 1 `ally`
  relationship point. Limited to once per real day per NPC
  (`canTalkToday`/`recordTalk`, `web/src/game/hub/talkCooldown.ts`, mirroring
  the §7 `dig` reaction's cooldown pattern) so it can't be farmed by
  repeatedly tapping the same NPC.
- **🎁 Give a gift** — only shown if the player holds at least one `'material'`
  category hub-item (§16). Advances to a second choice list, one button per
  distinct held material + "Never mind" (the same chained-`DialogueChoice`
  pattern used for pet/ambient-animal feeding). Picking one consumes it and
  grants friendship + `ally` relationship points. If the item's id matches the
  NPC's optional `favoriteGiftItemId` (see below), the bonus is bigger and
  applies to `favoriteGiftTrack` instead (default `'ally'`).

### Favorite gift (`HubNpc.favoriteGiftItemId` / `favoriteGiftTrack`)

Optional fields on a `config.json` NPC entry:

```jsonc
{ "id": "scholar", "name": "Loremaster Caelen", /* … */,
  "favoriteGiftItemId": "poetry-book", "favoriteGiftTrack": "romance" }
```

Both are additive and optional — omitting them (the default for almost every
NPC today) just means every material gift grants the flat generic bonus.
`favoriteGiftTrack` must be one of `RELATIONSHIP_TRACKS` (`'ally' | 'rival' |
'romance'`) or it's ignored and treated as unset (falls back to `'ally'`).

### Authoring checklist

Nothing is required for the base mechanism — it works for every NPC in
`HUB_NPCS` with zero JSON changes. To curate a favorite gift for a specific
NPC:

1. Add `favoriteGiftItemId`/`favoriteGiftTrack` to that NPC in its town
   `config.json`.
2. Run `npm run test` (loader tests parse all configs) and `npm run build`.
3. Verify in-game: gifting the favorite item shows the bigger-bonus flavor
   line and moves the configured track further than a generic material gift.

For an item worth hiding rather than buying, pair the favorite gift with a
**secret** interactable elsewhere in the same town (§7's "new secret /
dig-spot" checklist) that discovers the item via `giveItem`'s `hubItem` field
— see the live examples there (Gearford/Thornwood Camp/Saltmere Port).

---

## §7e — Bounty Rewards & Gating (friendship / relationship)

Bounties (`web/src/game/hub/bounties.ts`) can now grant friendship/relationship
on turn-in, and can themselves be gated behind a relationship/friendship level
— so a well-liked NPC can offer unique bounty content.

### Reward shape (`BountyReward`)

Mirrors `HubQuestReward` (§7c) exactly:

```ts
export interface BountyReward {
  crystals: number
  accessory?: string
  friendship?: Record<string, number>            // npcId -> xp
  relationship?: Record<string, RelationshipGrant> // npcId -> { track, points }
}
```

Applied in `turnInBounty(id, townNpcs)` — the same NPC list `HubWorld.tsx`
passes to `<BountyBoardModal townNpcs={locationData.HUB_NPCS} />`, so
relationship grants correctly trigger the rivalry reaction (below) exactly
like quest/dialogue-tree grants do.

### Shared rivalry-aware granting (`relationships.ts`)

The relationship-grant + rivalry logic (§7c "Rivalry") lives in
`web/src/game/hub/relationships.ts` as `grantRelationshipWithRivalry(npcId,
track, points, townNpcs)` — a pure function (no React), so both
`HubWorld.tsx` (quests, dialogue-tree effects, Talk/Give) and `bounties.ts`
(bounty rewards) call the same code path. Never call the raw
`addRelationshipPoints` directly from a player-facing grant site — always go
through `grantRelationshipWithRivalry` so rivalry stays consistent everywhere.

### Gating (`BountyDef.prerequisite`)

Optional `prerequisite?: string` on a bounty template, filtered in
`getDailyBounties()` before the day's 3 are drawn. Supports the same
`friendship:<npcId>:<level>` / `relationship:<npcId>:<track>:<level>` forms as
quest `prerequisite` (§14) — parsed by a small **local**
`checkBountyPrerequisite` in `bounties.ts` (deliberately not shared with
`HubWorld.tsx`'s `checkPrerequisite`, since bounties are a plain non-React
module and this parse is small/stable enough not to warrant a cross-layer
import). An ungated bounty (no `prerequisite`) is always eligible, as before.

### Authoring checklist: new gated/rewarding bounty

1. Add `friendship`/`relationship` to the bounty's `reward` (either/both,
   optional) using the shapes above.
2. Add `prerequisite: "relationship:<npcId>:<track>:<level>"` (or
   `friendship:<npcId>:<level>`) if this bounty should only appear once the
   player has reached that standing with the NPC.
3. **Append** new templates to the end of `BOUNTY_TEMPLATES` rather than
   inserting them earlier — `getDailyBounties`'s date-seeded draw indexes into
   the filtered pool, so appending keeps existing fixed-date test/story
   expectations intact when the new template is filtered out (unmet
   prerequisite).
4. Run `npm run test` (`bounties.test.ts`) and `npm run build`.
5. Verify by reading the flow: raise the NPC's track/level until the bounty
   appears in the daily pool, confirm turn-in grants the reward and (for an
   `ally`/`romance` grant) still correctly feeds any configured rivalry.

---

## §7f — Disliked Gifts, Negative Friendship & Friendship-Extreme Quests

Friendship (`web/src/game/hub/friendship.ts`) is signed — an NPC's standing
can go negative ("hated"), not just sit at zero. This backs three related
features: gifts an NPC dislikes cost friendship, quests that only open at max
friendship, and quests that only open once an NPC hates the player.

### Signed friendship ladder

`XP_THRESHOLDS = [0, 10, 25, 50, 100]` is now mirrored below zero.
`addFriendshipXp(npcId, xp)` recomputes the level from the running xp total
every call (not an increment-only counter), so a negative delta correctly
lowers the level, including past zero into negative territory. `getFriendshipLevel`
is unchanged in shape — it just now returns something in roughly `[-5, 5]`
instead of always `[0, 5]`. `MAX_FRIENDSHIP_LEVEL` (`= 5`) is exported for
gating "as high as it goes" content.

### Gift tiers (extends §7d)

`HubNpc.dislikedGiftItemIds?: string[]` — hub-item ids (must be `category:
'material'` to ever appear in the Give list) this NPC dislikes. `giveGiftToNpc`
now has three tiers:

| Tier | Condition | Effect |
|---|---|---|
| Favorite | `itemId === favoriteGiftItemId` | `+10` friendship, `+8` configured relationship track, "light up" line |
| Disliked | `itemId` in `dislikedGiftItemIds` | `-8` friendship, **no** relationship change, a rejection line naming the item |
| Neutral | anything else | `+3` friendship, `+2` ally relationship, an unenthusiastic acceptance line |

The item is consumed in all three tiers — a disliked gift is still handed
over, the NPC just isn't happy about it.

### `hatred:<npcId>:<level>` prerequisite

Mirrors `friendship:<npcId>:<level>` but checks the negative direction:
`getFriendshipLevel(npcId) <= -<level>`. Implemented alongside the existing
`friendship:`/`relationship:` clauses in both `checkPrerequisite`
(`HubWorld.tsx`, for quests) and `checkBountyPrerequisite` (`bounties.ts`, for
bounties). "Max friendship" gating needs no new syntax — use the existing
`friendship:<npcId>:<level>` form with `<level>` set to `MAX_FRIENDSHIP_LEVEL`.

### Hub-item quest rewards (`HubQuestReward.hubItem`)

```ts
export interface HubQuestReward {
  // …
  /** Hub-item id (hubItems.json) + count granted on quest completion. */
  hubItem?: { itemId: string; count?: number }
}
```

Applied in `grantQuestReward` via `addHubItem`, mirroring the `giveItem`
reaction's `hubItem` field (§7) and `BountyReward`'s fields (§7e). Live
example: Ravenwatch's `merchants-contempt` quest (prerequisite
`hatred:merchant:1`) rewards a `mouldy-slipper` — see below. Reused (not
re-minted) for Millhaven's `regattas-scorn` (Regatta Master Coll),
Gravemoor's `pedlars-grudge` (The Spectral Pedlar), Appleford's `hobs-grudge`
(Hob the Picker), Harrowfield's `rooks-toll` (Miller Rook), Hollowmere's
`ogrims-bad-mood` (Ogrim the Bouncer), Ironhold Keep's `olens-grudge`
(Gatekeeper Olen), Capital City's `bryns-cold-shoulder` (Guardsman Bryn),
Dreadspire Citadel's `gholls-contempt` (Warden Gholl), and Royal Palace's
`bricks-cold-post` (Guardsman Brick) hate-quests — all funnel to the same
buyer, James in Ravenwatch (`james-junk-trade`), per §16's
"items are reused across multiple grant points" philosophy.

### Authoring checklist: friendship-extreme quest with a joke-item reward

1. Gate the quest with `prerequisite: "friendship:<npc>:5"` (max) or
   `"hatred:<npc>:<level>"` (hated), same syntax as any other quest
   prerequisite (§14).
2. For a hate-quest reward, prefer a flavorful junk item over crystals —
   grant it via `reward.hubItem: { itemId, count? }`.
3. **Give that item a real trade chain** (§16) rather than a dead end: author
   a `tradeHubItem` buyer for it on some other NPC (a new one-node
   `dialogueTree` is enough if that NPC doesn't have one yet). Live example:
   Ravenwatch's `james-junk-trade` tree buys `mouldy-slipper` for 20💎.
4. Run `npm run test` and `npm run build`.
5. Verify by reading the flow: the quest only offers once the prerequisite is
   met, turn-in grants the item, and the trade-chain buyer accepts it.

---

## §8 — Animals

Living town ambience. Two kinds: **procedural** animals (spawned from town
geometry, anonymous, flavour-only) and **placed** animals (defined in
`config.json`, stable `id`, can give/receive quests). The PixiJS manager is
`createAnimalSystem` in `web/src/components/hub/hubAnimals.ts`; per-type data and
the pure maths live in `web/src/game/hub/animals.ts`.

### Registry — `ANIMAL_SPECS`

Every type is one entry in the `ANIMAL_SPECS` registry (the single source of
truth): `speed`, `scale`, tint `palette`, render `layer` (`sprite`/`overlay`/
`pond`), `nav` mode, a `spawn` rule, optional `fleesFrom`/`chases` relations,
and `dens` (uses the night schedule). `computeProceduralCounts(sources)` is
data-driven from these specs. **Adding a type** = a spec entry + sprites +
(usually) a thin `…Tick` hook in `hubAnimals.ts` reusing the shared primitives
(`stepToward`, `nearestThreat`/`nearestPrey`, `fleeBeacon`, `advance`, `speak`).

### Procedural spawn rules & caps

| Animal | Count | Source | Cap |
|---|---|---|---|
| Cats | 1 per 4 buildings | building count | 6 |
| Dogs | 1 per 4 NPCs | exterior NPC count | 4 |
| Birds | 8 per town (fixed) | — | 8 |
| Fish | 1 per 6 pond tiles | `HUB_POND_TILES` | 12 |
| Butterflies | 1 per 2 flower-decor tiles | flower decor in `EXTERIOR_DECOR` | 5 |
| Rabbits | 4 per town (where grass exists) | grass tiles | 4 |
| Chickens | 1 per 6 pen tiles | `chickenZones` | 8 |
| Frogs | 1 per 8 pond tiles | `HUB_POND_TILES` | 4 |
| Fireflies | 10 per town (fixed, **night only**) | — | 10 |
| Bats | 5 per town (fixed, **night only**) | — | 5 |

Fish/frogs need ponds; butterflies need flower decor; rabbits need grass;
chickens need a `chickenZones` pen — otherwise that type is simply absent.

### Day / night

A spec's optional `active: 'day' | 'night'` gates the sprite by time of day
(`isNightHour` = hour ≥ 20 or < 6). **Birds & butterflies** are `'day'` (they
vanish after dark); **fireflies & bats** are `'night'` (hidden by day). All four
are spawned once and shown/hidden by the tick. Cats & dogs **den** in buildings
at night (see below); **chickens roost** at night — they head to their pen's
roost tile (`chickenZones[].roost`, default the pen centre) and huddle until
morning.

### Navigation modes

`grass` (cats — greedy step avoiding solids, streets allowed) · `grass-only`
(rabbits — never streets) · `street` (dogs — street pathfinding, but they
**leave the path** via a grass step to chase prey) · `fly` (birds, butterflies —
free overlay movement) · `pond` (fish) · `pond-edge` (frogs) · `zone` (chickens
— clamped to a pen rect).

### Behaviours

- **Cat** — lazy: mostly `sleep`/`sit`, only rousing for a stimulus — a dog to
  flee, a **bird or butterfly** to chase, another cat to play with (♪), or an
  NPC who might feed them (?). Roams off the paths onto grass.
- **Dog** — picks a named-NPC `owner`; `follow-owner / roam` on the streets,
  **chases cats and rabbits** (leaving the path onto grass to pursue), and reacts
  to *new* NPCs by rolling like/dislike → wag (♥) or bark.
- **Bird** — `perched` on roof ridges or empty path tiles; flees everything by
  flying off-screen and re-pitching.
- **Fish** — gentle swim within pond tiles, with a sine bob.
- **Butterfly** — flits **flower-to-flower** over an overlay layer with a
  fluttery bob; darts away when a cat is near.
- **Rabbit** — hops on **grass only**; freezes, then bolts from dogs/the player.
- **Chicken** — confined to a fenced **pen** (`chickenZones`); pecks and hops
  within it and scatters to the far corner when a dog or the player enters; at
  night it **roosts** at the pen's roost tile and huddles until morning.
- **Frog** — sits on **pond-edge** tiles, hops between them, and **plops** into
  the water (alpha dip) when something comes near, re-emerging at an edge.
- **Firefly** (night) — drifts slowly anywhere with a pulsing alpha **glow**.
- **Bat** (night) — swoops erratically across the night sky (overlay layer).

### Den schedule & building interiors

Roughly **half** of the procedural cats & dogs are assigned a **home building**
(a random building door) at spawn. They follow a **night-in / day-out** cycle
(`getGameHour`): at night (hour ≥ 20 or < 6) they path to their home door and
**go inside** (the exterior sprite hides, `insideBuilding` is set); in the
morning they re-emerge at the door. While denned they are excluded from the
exterior tick.

When the player **enters a building**, `HubTownCanvas` calls
`animalSystem.getAnimalsInBuilding(buildingId)` and spawns any denned cats/dogs
inside as `InteriorAnimal`s, tinted with their variant. They **wander the room**
with random one-tile hops across `interiorWalkable` (cats occasionally curl up
to sleep), ticked in the main loop while `interiorActive`, and are cleared on
exit. They are **tappable indoors** too (flavour bubble, like outside). Cats
navigate to their door outside with the grass-capable greedy stepper; dogs use
the street pathfinder.

Placed animals with `roam !== true` are **stationary**: they do not wander or
flee, so the player can always reach them to tap (important for quest givers,
especially birds, which otherwise flee on approach).

### Colour variants

One neutral-grey base SVG per type (`animal-<type>.svg`, with `-1/-2/-3`
walk/fly frames for animated types and `animal-cat-sleep`), recoloured at spawn
via `sprite.tint`. `variant` may be a palette key (each spec's `palette`, e.g.
`"orange"`, `"brown"`, `"grey"`) or a hex string (`"#e8923c"`); omit it for a
random palette colour.

### Chicken pens (`config.json` → top-level `chickenZones`)

```json
{ "chickenZones": [ { "rect": [tx, ty, w, h], "count": 3, "roost": [tx, ty] } ] }
```

Each `rect` is a fenced area (draw it over existing fence decor). Chickens spawn
and stay inside; `count` is optional (defaults to the 1-per-6-tiles rule, capped
at 8); `roost` (optional, defaults to the pen centre) is where they huddle at
night. No zones ⇒ no chickens. Parsed into `HUB_CHICKEN_ZONES` by `loader.ts`.

### Placed-animal config schema (`config.json` → top-level `animals`)

```jsonc
{
  "animals": [
    {
      "id": "rover",                  // unique; shares NPC quest id space
      "type": "dog",                  // cat | dog | bird | fish
      "variant": "brown",             // palette key or hex; optional
      "tx": 33, "ty": 32,
      "name": "Rover",                // shown as the dialogue speaker
      "dialogue": ["*woof!*"],        // first line used on tap (flavour / fallback)
      "questGive": "wheres-rover",    // optional — quest this animal offers
      "questReceive": "feed-the-stray", // optional — quest(s) it completes/receives
      "roam": false,                  // default false (stationary); true = wanders
      "areaRect": [tx, ty, w, h]      // optional roam bounds (reserved)
    }
  ]
}
```

### Quests with animals

Placed animals route taps through `handleNpcTap` (in `HubWorld.tsx`) by `id`,
so quests reference them exactly like NPCs:

- **Animal as giver:** set the animal's `questGive` and the quest's
  `giverNpcId` to the animal `id` (giver==receiver works for a self-contained
  collect quest, e.g. *Where's Rover?*).
- **Animal as quest step / receiver:** set a `deliver` step's `targetNpcId`
  (and `receiverNpcId`) to the animal `id`, and give the animal
  `questReceive` (e.g. *Feed the Stray* delivers fish to a cat).

A `!`/`?` quest indicator floats above placed animals that have
`questGive`/`questReceive`, driven by the same `questNpcState` map as NPCs.

### Authoring checklist: new animal quest

1. Add the animal to the town's `config.json` `animals` array with a stable
   `id`, a `name`, `dialogue`, and `questGive`/`questReceive`. Use `roam:false`
   (default) for quest givers/receivers so they stay tappable.
2. Author the quest in `questDefs.json` `quests`, pointing `giverNpcId` /
   `receiverNpcId` / `targetNpcId` at the animal `id`.
3. Add any `collect`-step `pickupItems` (tile constants from `baseChipIndex.ts`).
4. Run `npm run test` and `npm run build`; verify the `!` shows, the quest
   offers, pickups collect, and tapping the animal completes it.

### Player's Follower Pet

A single, global (not per-town), dog-only adoptable pet follows the player's
avatar around every town, reusing the existing `follow-owner` dog state
machine above with zero changes to its movement/pathing logic.

- **Store** — `web/src/game/hub/pet.ts` (key `jarv_hub_pet`): holds one
  `PetRecord { type, variant, name }` or `null`. `adoptPet` replaces any
  existing pet (a "swap"); `renamePet`/`dismissPet` operate on the active
  pet. `type` is stored as a plain string for future extension, but only
  `'dog'` is offered today.
- **Runtime mechanism** — `hubAnimals.ts` exports two sentinel ids:
  `PLAYER_OWNER_ID` and `PLAYER_PET_ANIMAL_ID`. `HubTownCanvas.tsx` pushes
  `{ id: PLAYER_OWNER_ID, x: avatar.x, y: avatar.y }` into the array
  `getNpcPositions()` returns every tick, so a dog whose `ownerId` is
  `PLAYER_OWNER_ID` follows the live avatar through the same `dogIdle`/
  `followToward` logic ambient dogs already use to follow a random NPC.
  `AnimalSystem.spawnFollowerPet(variant, tx, ty)` spawns (or re-spawns) the
  pet near the avatar's start tile on every town mount if `getActivePet()`
  returns non-null; `AnimalSystem.removeAnimal(id)` is the generic
  best-effort removal used to despawn it.
- **Ephemeral sprite, persisted record** — the pet's sprite is a fresh
  runtime-only animal (not listed in any town's static `animals` config),
  respawned each time a `HubTownCanvas` mounts. Only the `jarv_hub_pet`
  localStorage record survives a reload, identical to how every other
  animal in the game is re-created per session.
- **UI** — `PetModal.tsx`, opened either via the `adopt-pet` screen reaction
  on a shelter interactable (see §7), the 🐾 toolbar button (shown only
  while a pet is active), or the **Manage** choice on the tap menu below.
  Has an **Info** tab (rename, dismiss, swap — confirms before replacing an
  existing pet) and an **Accessories** tab (below), reusing the
  `hoa-tabs`/`hoa-tab`/`hoa-tab--active` classes `TownJournal.tsx` also uses.
- **Wander cap** — the player's pet is never allowed more than
  `PLAYER_LEASH_TILES` (8) tiles from the player, enforced three ways in
  `hubAnimals.ts`, all scoped to `a.ownerId === PLAYER_OWNER_ID`: `dogIdle`'s
  `roam` branch and `sendPetFetching`'s "walk out" destination are both
  chosen relative to the *player's* live tile (not the dog's own tile, which
  would let repeated roams/fetches compound drift); and a tick-final
  safety-net check forces `state = 'follow-owner'` the instant the dog ends
  up beyond the cap for any reason (chase, etc.), overriding whatever it was
  doing. This makes "never more than 8 tiles" a true invariant rather than a
  property of any one behaviour.
- **Interactions** — tapping the live pet sprite opens a choice menu
  (`handleAnimalTap` in `HubWorld.tsx`, via the same `QuestEvent.choices`
  dialogue system used for NPC/quest branching) instead of jumping straight
  to `PetModal`:
  - **Give a Treat** — capped at 2/day (`pet.ts`: `getTreatsRemainingToday`/
    `canGiveTreat`/`recordTreatGiven`, a date-keyed counter mirroring
    `bounties.ts`'s daily-reset pattern). Calls `AnimalSystem.sendPetFetching
    (onReturn)`, which drives the dog through two forced (never
    idle-weighted) states — `fetching-out` (walks to a reachable tile 4-8
    tiles from the player) then `fetching-return` (walks back via the same
    `followToward` player-tracking `follow-owner` uses) — and fires
    `onReturn` once it's back within ~3 tiles. `onReturn` grants one of a
    small crystal amount, a random common/uncommon card, or a flavour
    trinket collectible.
  - **Pet / Belly Rubs / Brush** — free, unlimited, no cooldown. Each calls
    `AnimalSystem.givePetAffection()` (wag + `♥` bubble, the same cosmetic
    reaction ambient dogs give a liked NPC) with a different flavour line.
  - **Manage** opens `PetModal`; **Never mind** dismisses the menu.
  - `AnimalSystem.sendPetFetching`/`givePetAffection`/`setPetAccessory` (see
    below) reach `HubWorld.tsx` via `petActionRef`, the same imperative
    ref-bridging pattern `interiorEnterRef` uses.

#### Pet accessories

Collars, hats, bows, bow ties, boots, and coats — earned from quests,
bounties, and a shop — with a real **composite sprite** showing the dog
wearing the equipped item in the world, not just a UI badge.

- **Catalog** — `web/src/data/petAccessories.ts`: `PET_ACCESSORIES`, an
  array of `{ id, slot, name, price }`. `slot` is one of `'collar' | 'hat' |
  'bow' | 'bow-tie' | 'boots' | 'coat'`. Adding a second accessory for an
  existing slot is just one more catalog entry + one more SVG.
- **Data model** — `pet.ts`'s store gains `accessories?: { owned: string[];
  equipped: Partial<Record<AccessorySlot, string>> }`. Keying `equipped` by
  slot (not a single flat id) is what makes "one equipped at a time" cheap
  to loosen later: `getOwnedAccessoryIds`/`ownsAccessory`/`grantAccessory`
  manage ownership; `getEquippedAccessoryId` returns the one worn item (if
  any); `equipAccessory(id)` looks up the accessory's slot and **replaces
  the entire `equipped` map** with just that one slot — removing that
  single "clear other slots" line is the only change needed to support
  multiple simultaneous slots in future; `unequipAccessory(id)` clears it.
- **Composite sprite** — `hubAnimals.ts`. Every accessory SVG
  (`web/public/sprites/pet-accessory-<id>.svg`) is authored in the exact
  same `viewBox="0 0 32 32"` coordinate space as `animal-dog.svg`. Because
  the dog sprite is bottom-anchored (`anchor.set(0.5, 1)`), giving the
  accessory sprite the identical `width`/`height`/`anchor`/position every
  tick lines it up with zero offset math. It's a PIXI **sibling** of the dog
  sprite (`Animal.accessorySprite`), not a child — the dog's *texture* swaps
  every animation frame rather than its transform moving, so only per-tick
  sibling repositioning (mirrored in `advance()`, alongside the dog
  sprite's own `x`/`y`/`scale.x`/`zIndex`) keeps it aligned.
  `AnimalSystem.setPetAccessory(assetId | null)` swaps or removes it live;
  `spawnFollowerPet` applies `getEquippedAccessoryId()` immediately on
  spawn so it persists across town changes/reloads.
- **UI** — `PetModal.tsx`'s Accessories tab: a grid of all 6 catalog
  entries. Owned ones are tappable to equip/unequip (calling
  `equipAccessory`/`unequipAccessory` + `petActionRef.current?.
  setPetAccessory(id)` to update the live sprite immediately); un-owned ones
  show a locked hint pointing at quests/bounties/the shop.
- **Earning channels** — `HubQuestReward`/`BountyReward` both gained an
  `accessory?: string` field, applied in `HubWorld.tsx`'s centralized
  `grantQuestReward()` and `bounties.ts`'s `turnInBounty()` respectively
  (2 accessories each, wired onto existing Ravenwatch quests/bounty
  templates). The remaining 2 sell at **Tailor Pell** in Crownhaven
  (capitalcity's `tailor` building) — a new `'accessory'`
  `ShopTraderKind` in `shopStock.ts` (`getAccessoryStock()`, a fixed
  2-item list, unlike the date-rotating card/augment/consumable stock)
  registered in `SHOP_TRADER_REGISTRY`, with 2 `buy` interactables inside
  `tailor` mirroring the `grand-bank`/`jeweller` decor+buy pattern (§7).
  Because accessories are a permanent one-time unlock rather than daily
  stock, `isShopItemSold()` treats an `'accessory'` grant as sold once
  `ownsAccessory()` is true — that check never resets, unlike the
  card/augment "bought today" state it shares a function with.

---

## §9 — NPC Schedules & Activities

Named NPCs (`config.json` → `npcs`) can follow a **time-of-day schedule**: a list
of entries that relocate the NPC between exterior tiles and building interiors as
the hub clock advances (30 real minutes = 1 game day, see `hubClock.ts`). At each
scheduled stop an NPC may also perform a visible **activity** — rendered by
swapping to an activity **pose sprite** — so the town feels lived-in. Parsed
straight through by `loader.ts`; logic lives in
`web/src/game/hub/hubNpcSchedule.ts`, rendering in `HubTownCanvas.tsx`. NPC
schedules and activities are also editable in the in-app map editor
(`components/mapEditor/npcQuestDrawer/NpcEditor.tsx`).

### Schema (`HubNpc.schedule`)

```jsonc
{
  "id": "fisherman",
  "name": "Old Pell",
  "sprite": "hub-npc-fisherman",
  "tx": 50, "ty": 50,
  "dialogue": ["..."],
  "schedule": [
    { "startHour": 0,  "endHour": 6,  "activity": "sleep",
      "location": { "type": "interior", "buildingId": "inn-building-upstairs", "tx": 7, "ty": 1 } },
    { "startHour": 6,  "endHour": 20, "activity": "fish",
      "location": { "type": "exterior", "tx": 50, "ty": 50 } },
    { "startHour": 20, "endHour": 0,  "activity": "eat",
      "location": { "type": "interior", "buildingId": "inn-building", "tx": 4, "ty": 4 } }
  ],
  "homeBed": { "buildingId": "inn-building-upstairs", "tx": 7, "ty": 1 }
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `startHour` / `endHour` | `number` (0–23) | ✓ | Half-open `[start, end)` game-hour window. **Wraps midnight** when `start > end` (e.g. `20 → 0`). The first matching entry wins; cover all 24 hours to avoid gaps. |
| `activity` | `NpcActivity` | | Visible activity at this stop (see list below). Omit for "just stand there". |
| `location.type` | `"exterior"` \| `"interior"` | ✓ | Where the NPC is during this window. |
| `location.tx` / `ty` | `number` | ✓ | Exterior: absolute hub coords. Interior: coords within that building's room grid. |
| `location.buildingId` | `string` | interior only | Building `id` the NPC waits inside. The exterior sprite hides; if the player enters that building the NPC renders inside (its activity pose shows there too). |
| `homeBed` | `{ buildingId, tx, ty }` | | Reserved sleeping spot reference (used by night logic). |

On a game-hour boundary the NPC pathfinds to the new location (emerging at / walking
to the relevant door for interior transitions). The activity pose only shows while
the NPC is **standing at its post** — it reverts to the base sprite while it walks.

### Activities (`NPC_ACTIVITIES` in `hubNpcSchedule.ts`)

| Activity | Typical use |
|---|---|
| `work` | Manning a stall, smithing, labouring |
| `sweep` | Tidying a doorway / square |
| `fish` | Fishing at the pond edge |
| `idle-chat` | Chatting / gossiping in the open |
| `eat` | Eating at the inn |
| `sleep` | Resting in a bedroom |

`NPC_ACTIVITIES` is the single source of truth for editor dropdowns — add an entry
there **and** to the `NpcActivity` union in `loader.ts` to introduce a new activity.

### Pose-swap sprites (optional art)

While an NPC performs an activity, `HubTownCanvas` swaps its sprite texture to
`web/public/sprites/{sprite}-{activity}.svg` if that file exists, e.g.
`hub-npc-fisherman-fish.svg`. **Missing pose files fall back to the base sprite**,
so poses are purely additive — only author the combos you want. Follow the sprite
workflow in `AGENTS.md` (32×32 SVG, create/commit/push one at a time).

### Authoring checklist: schedule activity

1. Add/extend the NPC's `schedule` in the town `config.json`, setting `activity`
   on the relevant entries (use the activity keys above).
2. (Optional) Author `{sprite}-{activity}.svg` pose sprites for a richer look.
3. Run `npm run test` (loader + schedule tests) and `npm run build`.
4. Verify in-game: at the relevant hours the NPC is at its post in its activity
   pose; the pose reverts to the base sprite while it walks at an hour boundary.

---

## §10 — Town Reputation & Building Upgrades

Towns gain a **reputation** (standing) value and their buildings gain **upgrade
levels**. Reputation is *earned by investing crystals*: each upgrade purchase
spends crystals, raises the town's reputation, and reputation in turn **gates the
higher upgrade tiers**. Buying an upgrade reveals a **visible decor change** at the
building and unlocks a labelled **service/benefit**. All state persists in
localStorage.

- Store: `web/src/game/hub/reputation.ts` (key `jarv_hub_reputation`).
- Catalog: `web/src/data/hub/buildingUpgrades.json` (+ typed `.ts`).
- UI: `web/src/components/hub/HubTownUpgrades.tsx`, opened from the 🏗️ toolbar
  button in `HubWorld.tsx` or the `town-upgrades` screen route (so an interactable
  with `{ "type": "screen", "screen": "town-upgrades" }` also opens it).
- Decor rendering: `HubTownCanvas.tsx` (toggled per-frame against
  `buildingUpgradeLevelsRef`, mirroring the §2 blocked-path decor pattern).

### Making a building upgradeable

Tag the building in its town `config.json` with an `upgradeKind` — the key of an
upgrade track in `buildingUpgrades.json`:

```jsonc
{
  "id": "cider-house",
  "upgradeKind": "tavern",
  "rect": [4, 2, 11, 8],
  "wall": "woodWall", "roof": "redSlateRoof",
  "doors": [ { "tx": 4, "ty": 1, "buildingId": "cider-house" } ]
}
```

The building **must have a door** (decor is placed relative to its primary door
tile). The display name in the panel comes from the building's interior `name`,
falling back to a title-cased id.

### Upgrade catalog schema (`buildingUpgrades.json`)

Keyed by `kind`; each value is an ordered list of levels (level 1 first). Built-in
kinds: `shop`, `inn`, `tavern`, `cottage`, `workshop`, `shrine`, `default`.

| Field | Type | Description |
|---|---|---|
| `label` | string | Level title shown in the panel. |
| `cost` | number | Crystals to purchase this level. |
| `repReward` | number | Town reputation granted on purchase. |
| `repRequired` | number | Town reputation needed before this level can be bought (the tier gate). |
| `benefit` | string | One-line description of what the level unlocks. |
| `service` | string? | Service id readable via `getUnlockedServices`/`hasTownService`. |
| `decor` | `{dx,dy,tileId}[]`? | Decor revealed at this level, offset from the building's primary door. `tileId` is a `baseChipIndex.ts` constant name. |

Reputation tiers/names live in `buildingUpgrades.ts` (`REPUTATION_TIERS`,
`REPUTATION_TIER_NAMES`, `getReputationTier`).

### Per-building level variants (map editor)

The shared `decor` track above applies to *every* building of a kind. To author
how **one specific building** looks and behaves at each upgrade level, use the
map editor's **level selector** (shown on the Building inspector and inside an
interior). Stepping the level previews that level (higher-level content is
dimmed) and tags anything you place with the selected level. Levels are
**cumulative**: an item with `minLevel: 2` appears once the building reaches
level 2 and stays for all higher levels.

This is stored directly in `config.json` via three optional fields:

| Field | Where | Effect |
|---|---|---|
| `levelDecor` | on a building | Per-building exterior decor (absolute `tx`/`ty`). Each item carries `minLevel`. When present it **replaces** the shared kind-track decor for that building. |
| `minLevel` | on an interior `decor` item | Interior decor that only appears at/above this upgrade level. |
| `minLevel` | on an interior `exits[]` entry | The room behind the doorway is **unavailable** (door closed, not walkable) until the level is reached. |
| `minLevel` | on an NPC | The NPC (and the quests it gives/receives) is **absent** until the level is reached. |

```jsonc
{
  "id": "cider-house", "upgradeKind": "tavern", "maxLevel": 3,
  "rect": [4, 2, 11, 8],
  "levelDecor": [
    { "tx": 3, "ty": 9, "tileId": "barrel" },                 // base — always shown
    { "tx": 12, "ty": 9, "tileId": "drinkSign", "minLevel": 2 } // appears at level 2+
  ]
}
```

At runtime `HubTownCanvas` resolves the building's current level
(`getUpgradeLevel`) and filters interior decor / exits / NPCs and per-building
`levelDecor` by `minLevel`. Sub-rooms (interiors with no exterior door) inherit
the level of the parent building whose id prefixes the interior id. `maxLevel`
(optional) caps how many levels the editor offers; it defaults to the
`upgradeKind` track length.

### Services

Each unlocked `service` id is readable via `getUnlockedServices(town)` /
`hasTownService(town, id)`; `HubWorld` registers the `upgradeKind` resolver with
`setUpgradeKindResolver` so these reads work without importing the loader. The
benefit text is shown in the panel, and the guaranteed visible change on purchase
is the **decor**.

The first concrete payoff wired to services is the **daily town tribute**: the
town pays a small crystal stipend scaled by how many services its buildings have
unlocked (`tributeAmount` = `10 + services × 8`), claimable once per real day from
the panel header (`tributeAmount` / `tributeAvailable` / `collectTribute` in
`reputation.ts`). This turns every unlocked service into a tangible daily return on
the crystals invested. Additional service-specific effects can hook the same
`getUnlockedServices`/`hasTownService` reads.

### Authoring checklist: new upgrade track / upgradeable building

1. (New kind only) Add a `kind` entry to `buildingUpgrades.json` with ordered
   levels — escalating `cost`/`repRequired`, a `benefit`, and `decor` whose
   `tileId`s exist in `baseChipIndex.ts`.
2. Add `"upgradeKind": "<kind>"` to the building in its town `config.json`; ensure
   the building has a `door`.
3. Run `npm run test` (loader tests parse every config; `reputation.test.ts` covers
   the store) and `npm run build`.
4. Verify in-game: open 🏗️ Town Upgrades, buy a level → crystals drop, standing
   rises, the new decor appears on the building immediately, a rep-locked tier
   stays blocked until standing is high enough, and everything survives a reload.

---

## §11 — Hub Audio (music, ambiance & SFX)

The hub world has its own procedural audio (no external files — everything is
synthesised in `web/src/game/sound.ts`, respecting the global mute/volume).

### Town music
A calm town theme (`HUB_MUSIC`, id `hub`) starts whenever the hub screen is
active, routed by `web/src/hooks/useMusic.ts` (one track at a time, same contract
as battle/map music).

### Per-building music & ambiance
Each interior in `config.json` may set two optional fields:

| Field | Type | Description |
|---|---|---|
| `musicId` | `string` | Swaps the town theme for a building track while the player is inside. Keys: see `BUILDING_MUSIC_TRACKS` (`inn`, `church`, `shop`). Omit to keep the town theme. |
| `ambianceId` | `string` | A low-volume looping bed layered **under** the music. Keys: see `AMBIANCE_TRACKS` (`hearth`, `sacred`, `market`). Omit for silence. |

On entering a building `HubTownCanvas` calls `startInteriorAudio(musicId, ambianceId)`;
on exit `stopInteriorAudio()` restores the town theme and drops the ambiance.
Both id lists are exported (`BUILDING_MUSIC_IDS`, `AMBIANCE_IDS`) and surfaced as
dropdowns on the interior in the **map editor** (`EntityInspector` → Music /
Ambiance). Example (Ravenwatch): the inn uses `inn` + `hearth`, the church uses
`church` + `sacred`, the market hall uses `shop` + `market`.

To add a new track: define a `MusicTrackConfig` in `sound.ts`, add it to
`BUILDING_MUSIC_TRACKS` or `AMBIANCE_TRACKS`, and it appears in the editor.

### Ambient SFX
Wired through `emitSound(id)` (ids documented in `web/src/data/sounds.json`):
`hubFootstep` (throttled, per walk tile), `pickup` (item collect), `treasure`
(chest), and `dayNightChime` (dawn/dusk transition). All honour mute/volume.

### Night crickets
An outdoor night ambiance bed (`CRICKETS_AMBIANCE`, id `amb-crickets`) plays while
the hub is **at night and outdoors**. `HubTownCanvas` calls `setNightAmbiance(on)`
from its ticker with `on = isNight && !interiorActive` (idempotent), so crickets
start/stop on the day↔night flip and on building enter/exit; `useMusic` clears
them when leaving the hub screen.

### Animal vocalisations
Hub critters make sounds via `emitSound`: `dogBark`, `catMeow`, `birdChirp`,
`henCluck` (mapped per type in `ANIMAL_SFX`, `hubAnimals.ts`). They fire when an
animal is tapped, when a dog spontaneously barks, and ambiently — every 5–10 s a
random visible critter near the avatar vocalises. A single global throttle
(`_lastAnimalSfxMs`, 250 ms) prevents overlap into a cacophony. Add a new vocal
type by adding its `SoundId` to `ANIMAL_SFX`.

---

## §12 — Weather

A screen-space PixiJS overlay renders rain / snow / fog above the world (and
above the night-dimming layer), hidden while inside a building. The pure
selection logic is `resolveWeather` in `web/src/game/hub/weather.ts`; the
renderer is `createWeatherSystem` in `web/src/components/hub/hubWeather.ts`
(particle pools are capped — ≤240 rain, ≤200 snow — and recycled as they leave
the viewport, so cost is independent of map size). A standalone
`HubWeather.tsx` wrapper + `HubWeather.stories.tsx` show each type in Storybook.

### Config (`config.json` → optional top-level `weather`)

```jsonc
{
  "weather": {
    "type": "fog",                 // force one type (overrides everything)
    "bySeason": {                  // OR pick by current season
      "spring": "rain", "summer": "rain", "autumn": "fog", "winter": "snow"
    }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"clear" \| "rain" \| "snow" \| "fog"` | Forces a single weather type. Highest precedence. |
| `bySeason` | `Partial<Record<Season, WeatherType>>` | Maps the current real-date season (`seasonForDate`) to a weather type. Used when `type` is absent. |

**Resolution precedence:** `type` → `bySeason[currentSeason]` → per-`environment`
default (`snow`/`ice`/`tundra` → snow; `swamp`/`marsh`/`graveyard`/`ashen` → fog;
`forest` → rain; others → clear) → `clear`. Omit `weather` entirely to use the
environment default. `WEATHER_TYPES` in `weather.ts` is the canonical type list.

---

## §13 — Map Editor config coverage

The in-app **Map Editor** (`web/src/components/mapEditor/`) can author every
field in a town's `config.json` and `questDefs.json`. Save writes both files
back whole (the editor `structuredClone`s the full config/questDefs, so unknown
or unedited keys are preserved).

| Data (file) | Where in the editor |
|---|---|
| mapW/H, townName, environment (config) | Town panel (no selection) |
| avatarStart, exitTiles, weather, ambientNpcSprites, npcSpawnTiles, pondTiles, chickenZones (config) | Town panel → extra sections |
| buildings, exteriorDecor, interiors, streets, areas, doors (config) | Canvas tools + Building/Interior/Street/Area inspectors |
| npcs, animals (config) | NPC drawer (NPCs tab) + canvas |
| treasures (config) | "+ Add Treasure" + Treasure inspector; quest-items overlay |
| interactables (config) | Interactables overlay toggle + Interactable inspector (incl. reactions) |
| lockedDoors (config) | Building inspector → locked door |
| quests, pickupItems (questDefs) | NPC drawer (Quests tab) |
| blockedPaths (questDefs) | "+ Add Road Block" + Blocked Path inspector; blocked-paths overlay |
| innRumours, friendshipDialogue, relationshipDialogue, dialogues (questDefs) | NPC drawer (Dialogue tab) |

**Pick-on-map:** NPCs, animals, treasures, interactables, exit tiles, avatar
spawn, and blocked-path tiles all support a "📍 Pick on map" button that sets
the location from the next canvas click (records the interior building when used
inside a room). Dialogue-tree `nodes` are edited as JSON within the Dialogue tab.

---

## §14 — Seasonal & Festival Events

A real-date calendar layer (`web/src/game/hub/hubCalendar.ts`) drives time-limited
festival content: decor swaps, festival-gated quests, and an "event active" HUD
badge. Builds on the weather `seasonForDate` helper.

### Festival registry (`FESTIVALS` in `hubCalendar.ts`)

The single source of truth for runtime, the map editor, and Storybook. Each entry:

```ts
{ id: 'midsummer', name: 'Midsummer Fair', icon: '🏮',
  start: { month: 6, day: 1 }, end: { month: 7, day: 15 } }
```

`getActiveFestival(date?)` returns the festival whose window contains the date
(windows wrap the new year when `start > end`, e.g. Midwinter Dec→Jan), or `null`.
Add a festival by appending to `FESTIVALS`.

### Festival decor (`config.json` → optional top-level `festivalDecor`)

```jsonc
{
  "festivalDecor": [
    { "festivalId": "midsummer", "decor": [
      { "tx": 34, "ty": 26, "tileId": "lampPostTop" },
      { "tx": 35, "ty": 31, "tileId": "flowerPotLeft" }
    ] }
  ]
}
```

Each group's `decor` uses the same shape as `exteriorDecor` (tile keys from
`baseChipIndex.ts`, optional `zlayer`). The loader resolves it to
`HUB_FESTIVAL_DECOR`; `HubTownCanvas` renders the group whose `festivalId` matches
the active festival, layered in with the base exterior decor.

### Festival-gated quests (`questDefs.json`)

Set `"festivalId": "<id>"` on a quest — it is only offered while that festival is
active (gated alongside `prerequisite`/`availableHours` in `HubWorld`). Any
`pickupItems` it references appear only while the quest is active, as usual.

### HUD badge

When a festival is active, `HubWorld` shows an `{icon} {name}` label next to the
clock.

### QA override (preview any festival on any date)

`setFestivalOverride(id | 'none' | null)` (localStorage `jarv_hub_festival_override`)
forces a festival, suppresses all festivals (`'none'`), or clears back to
date-driven (`null`). In dev it is exposed on `window.setFestivalOverride`.

### Map editor & Storybook

The editor toolbar's **Festival** selector previews a festival's decor live;
while a festival is selected, placing/moving/deleting exterior decor edits that
festival's group (not `exteriorDecor`). The quest editor has a **Festival**
dropdown for `festivalId`. The `MapEditor` Storybook stories
(`Ravenwatch · Midsummer/Harvest/Midwinter`) seed `initialFestival` so each
festival is previewable regardless of today's date.

---

## §14 — Quests: prerequisites & cross-town chains

### Prerequisite syntax
A quest's `prerequisite` is a single string of **AND-combined conditions**
joined with `|` (all must hold), parsed by `checkPrerequisite` in
`HubWorld.tsx`:

```
quest:<questId>                       // that quest is completed
friendship:<npcId>:<level>            // friendship ≥ level
relationship:<npcId>:<track>:<level>  // relationship track at ≥ level
flag:<flag>                           // that dialogue flag is set (§7b)
reputation:<tier>                     // current town's reputation tier ≥ tier (§10);
                                      // only meaningful where a town is in scope
                                      // (quest gates, buyHubItem prerequisites)
```

Example: `"quest:millhaven-mill-grain | friendship:innkeeper-rosie:2"`.

> A **bare** id (no `quest:` prefix) does **not** gate — `checkPrerequisite`
> treats unknown tokens as satisfied. The map-editor **Prerequisite** builder
> always writes the `quest:<id>` form, and re-serialises any legacy bare ids on
> save. Quest state is global, so a prerequisite may reference a quest defined in
> **any town**.

### Cross-town chains & steps
Quest progress lives in one global store keyed by quest id
(`game/hub/quests.ts`), and `ALL_QUEST_DEFS` (`hubWorldFactory.ts`) aggregates
every town. Therefore:

- **Chains span towns** — a quest in town B can require (`prerequisite`) a quest
  from town A.
- **Steps span towns** — a quest's `collect` step may list `pickupIds` that live
  in another town, and a `deliver` step may target an NPC in another town.
  `handleItemPickup` resolves the quest via `allQuestDefs`, and the NPC-tap
  delivery/turn-in logic scans `allQuestDefs` for a pending deliver step
  addressed to the tapped NPC (or a ready receiver) — so the quest advances and
  completes wherever the relevant pickup/NPC is. Offers still only appear on the
  giver in the quest's own town; the active-quest cap (2) counts globally.

### Map editor
Every id field (NPC, building, quest, pickup, interior, dialogue tree) is a
**searchable dropdown** (`EntityRefPicker`), and quest / cross-town refs are
**grouped by town**. The quest editor's deliver-target and pickup steps use
all-town pickers; the **Prerequisite** field is a structured condition builder
(quest / friendship / relationship rows).

---

## §15 — Town Journal

A bestiary/who's-who/gazetteer screen, opened via the toolbar's 📖 **Journal**
button. Three tabs, each tracking a different kind of discovery and showing a
`discovered/total` count plus an overall completion %:

- **Animals** — scoped **globally** (a species is the same animal everywhere,
  not per-town). Tracks which `AnimalType`s (§8) have been tapped at least
  once, and which named colour variants of each species have been seen.
- **People** — scoped to the **current town**: named NPCs from
  `locationData.HUB_NPCS` (de-duped by id, same filter as `TownDirectory`).
  Tracks which have been talked to; once met, shows their relationship-track
  icon (§7c) and friendship level (§1) alongside their own first dialogue line.
- **Places** — scoped to the **current town**: named areas from
  `locationData.HUB_AREAS`. Tracks which have been entered.

Undiscovered entries render as `???`, matching the `???` convention used by
`HallOfAchievements` and `TownDirectory`.

### Persistence — `web/src/game/hub/journal.ts` (key `jarv_hub_journal`)

| Export | Purpose |
|---|---|
| `recordNpcMet(npcId)` / `hasMetNpc(npcId)` / `getMetNpcIds()` | Mark/check/list met NPCs, by bare id (global, like `friendship.ts`). |
| `recordAnimalSeen(type, variant?)` / `hasSeenAnimal(type)` / `getSeenAnimalVariants(type)` / `getSeenAnimalTypes()` | Mark/check/list seen animal species and named tint variants. |
| `recordAreaSeen(town, areaId)` / `hasSeenArea(town, areaId)` / `getSeenAreaKeys()` | Mark/check/list seen areas, keyed via `interactableStoreKey(town, id)` since area ids are not unique across towns (e.g. Ravenwatch's bare `market`). |

Each `record*` is idempotent and returns whether it added new information,
mirroring `setDialogueFlag`'s dedup pattern (§7b).

### Wiring discovery events

Discovery fires on **tap**, not mere visibility, matching every other
"have they met X" signal in the codebase:

- `hubAnimals.ts`'s shared pointerdown handler calls `opts.onAnimalSeen(type,
  variantKeyForTint(type, tint))` for **every** animal tap (placed or
  procedural), before the `onAnimalTap` early-return for placed/id'd animals.
  `variantKeyForTint` (`animals.ts`) reverse-resolves a spawned sprite's
  numeric tint back to its named palette key for display.
- `HubWorld.tsx`'s `handleNpcTap` calls `recordNpcMet(npcId)` once the tapped
  id resolves to a **named** NPC (`HUB_NPCS`, not `HUB_ANIMALS`).
- `HubWorld.tsx`'s `handleAreaEnter` (passed as `HubTownCanvas`'s
  `onAreaEnter`) resolves the entered area's `id` from `HUB_AREAS` by name and
  calls `recordAreaSeen(HUB_TOWN_NAME, area.id)`.

### UI — `web/src/components/hub/TownJournal.tsx`

Reuses `TownDirectory`'s `ModalBackdrop` + `.town-directory__*` row layout and
`HallOfAchievements`' `.hoa-tabs`/`.hoa-tab`/`.hoa-tab--active` tab row — no new
tab CSS was needed. Story: `TownJournal.stories.tsx`.

---

## §16 — Hub Items, Inventory & Item Economy

A hub-world item economy layered on the shared item store: physical **quest
items** held while a fetch quest is in progress, **materials** bought from
shops or produced by world interactions (chicken feed, eggs, feathers, caught
fish, trade goods), and unique **tools** (the fishing rod). Everything
persists in `jarv_item_store` under its own type tag (`'hub-item'`), so — like
arcade tickets — it can never be drained into a campaign run.

- Catalog: `web/src/data/hubItems.json` — `{ id, name, icon, desc, category,
  unique? }`; `category` is `'quest' | 'pet-accessory' | 'material' | 'tool'`.
  Items flagged `unique: true` never stack (re-buying/re-adding is a no-op).
- Store API (`web/src/game/itemStore.ts`): `addHubItem(id, count?, display?)`,
  `removeHubItem(id, count?)` (returns `false` and changes nothing when the
  player holds too few — always check the return), `getHubItemCount`,
  `hasHubItem`, `getHubItems`, `getHubItemCatalogEntry`.
- UI: `HubInventoryModal.tsx`, opened from the 🎒 toolbar button in
  `HubWorld.tsx`. Sections: Quest Items (per active quest, `held/required`),
  Materials & Tools, Pet Accessories (owned accessories from `pet.ts` — see §8).

### Held quest items

A collect step (§14 quests) may carry two optional display fields:

```jsonc
{ "key": "grain", "type": "collect", "pickupIds": ["sack-1","sack-2","sack-3"],
  "required": 3, "itemName": "Sack", "itemIcon": "🌾" }
```

When set, each pickup adds one `quest:<questId>:<stepKey>` hub-item
(`questItemId` in `web/src/game/hub/questItems.ts`) with the step's display
fields inline; turning the quest in or abandoning it clears the held items
(`clearHeldQuestItems` in `HubWorld.tsx`). Steps without `itemName` behave as
before (progress counter only). All existing collect steps were retrofitted
with these fields, resolved from their pickups' `tileId`s.

### Buying hub items — `buyHubItem` (§7 reactions)

```jsonc
{ "id": "millhaven-bait-stall", "tx": 32, "ty": 11,
  "decor": [{ "dx": 0, "dy": 0, "tileId": "bucketAndRope" }],
  "reactions": [
    { "type": "buyHubItem", "itemId": "fish-bait", "price": 8, "speakerName": "Harbour Tackle Stall" }
  ] }
```

Always-available (no daily rotation). The confirm dialogue shows the catalog
`desc`; the speaker resolves to the on-duty building NPC unless `speakerName`
overrides it. Unique items re-offer as "already owned". Existing sellers:
chicken feed (Millhaven bakery, Ravenwatch Market Hall, pen-side feed sacks in
Appleford / Harrowfield / Ironhold Keep / Royal Palace), rod + bait (Millhaven
harbour stalls), Fancy Hat + Sturdy Boots (capital tailor), honey cake /
lavender tonic / silk ribbon (capital bakery / apothecary / Grand Market
Hall), smoked herring + bones (Saltmere fish market / smokehouse), bog salve
(Hollowmere apothecary), spice pouch (Ravenwatch Merchant's Guild Hall),
catching net (Saltmere Net Loft), spade (Gearford Tool Shop), storm lantern
(Saltmere Chandlery), gilded compass (Ravenwatch Guild Hall,
`reputation:2`-gated), harbour bucket (Millhaven stall), honey (Appleford
apiary).

### Trading hub items — `tradeHubItem` (§7b dialogue effects)

Attach to a dialogue-tree choice; see the §7b effect table. Point `next` back
at the same node to build a repeatable sell menu (see Millhaven's
`marta-fish-trade` tree — Fishwife Marta buys each fish tier for crystals) or
a one-line barter (Thornwood Camp's `ranger-sable-trade` — sturdy boots for
90💎). Trades are repeatable by design; use a `flag` effect + `hideIfFlag` on
the choice if a specific trade should be once-only.

The live trade network (buyer NPC → wants → gives): Weeping Widow (Gravemoor)
← poetry book, 50💎 · Widow Tamsin (Millhaven) ← lost locket, 60💎 ·
Harbourmaster Vane (Saltmere) ← fancy hat, 75💎 · Baker Otto (capital) ← 3
eggs, 20💎 · Little Wren (Appleford) ← honey cake, 25💎 · Old Hollis
(Gravemoor) ← lavender tonic, 40💎 · Squire Tomas (Ironhold) ← silk ribbon,
30💎 · Forager Mott (Thornwood) ← smoked herring, 25💎 · Smith Garrick
(Millhaven) ← bog salve, 35💎 · Innkeeper Cobb (Millhaven) ← spice pouch,
38💎 · Ranger Sable (Thornwood) ← sturdy boots, 90💎 · Archivist Quill
(capital) ← feather → poetry book · Fishwife Marta (Millhaven) & Fishwife
Pearl (Saltmere) ← any caught fish → tier-priced crystals · Master Fenwick
(capital) ← butterfly, 20💎 · Little Pip (Gravemoor) ← firefly, 30💎 +
friendship · Innkeep Rosalind (capital) ← 2 eggs + smoked herring →
45💎 (multi-item recipe) · Lady Cora (capital) ← poetry book → 20💎 +
romance points · Hedge-Witch Morwen (Hollowmere) ← 2 glowcap mushrooms →
moon draught · The Restless Soldier (Gravemoor) ← moon draught → 80💎 +
friendship · Busker Lyle (capital) ← butterfly → 35💎 **during Midsummer
only** (`requireFestival`) · Lighthouse Keeper Wren (Saltmere) ← gilded
compass → 160💎 · Trader Posy (Appleford) ← 3 eggs → 35💎 **during
Harvest only** · Sailor Bess (Saltmere) ← 2 smoked herring → 60💎
**during Midwinter only** (every festival now has a trade) · Net-Maker
Quill (Saltmere) ← 3 feathers → feather pillow · The Prisoner
(Ironhold dungeon) ← feather pillow → 55💎 + friendship · Grunda the
Soaker (Hollowmere) ← music box → 170💎 · James (Ravenwatch) ← mouldy
slipper → 20💎 (the reward from the `merchants-contempt` hate-quest, §7f).

Reputation-gated premium stock: gilded compass (Ravenwatch Guild Hall,
120💎) and music box (capital Grand Market Hall, 130💎), both
`reputation:2`.

Weather content: rain barrels (Millhaven — rains year-round — plus
Ravenwatch and Harrowfield in wet seasons) scoop `rainwater` with the
bucket; Sister Nettle (Hollowmere) pays 30💎 per two. The honey-pie chain:
Beekeeper Mabe's honey + an egg → Cook Mabel's (Ironhold) hearty pie →
Warden Rell (Thornwood) 50💎, or Shepherd Nan (Harrowfield) 75💎 **while it
snows** (`requireWeather`). The fog chain: Gravemoor's permanently-foggy
weather (`ashen` environment default, §12) lets a spade dig up `grave-moss`
year-round → Alchemist Sythe (Dreadspire Citadel `alchemy-lab`) brews 2 moss
into a `wraith-tonic` → the Spectral Pedlar (Gravemoor) buys it back for
65💎.

The longest chain: lantern (Chandlery) → dark hollow at night → glowcaps →
Morwen's moon draught → the Restless Soldier's first sleep in centuries —
4 hops across 3 towns, night-gated.

### Feeding ambient animals

Tapping an **ambient** (id-less, procedural) animal routes through
`onAmbientAnimalTap(type)` (hubAnimals.ts → HubTownCanvas → HubWorld) before
the default flavour bubble:

- **Chicken** + player holds `chicken-feed` → offers to feed (consumes 1):
  40% egg, 25% feather, 35% nothing.
- **Cat** + player holds any `fish-*` → offers the smallest held fish
  (flavour-only reward, by design — ambient animals have no stable id to
  attach friendship to).
- **Dog** + player holds `bones` → offers to feed (consumes 1): the dog runs
  off and, 60% of the time, returns with a `lost-locket`.
- **Butterfly / firefly** + player holds the `net` → offers to swing it:
  60% catches the `butterfly`/`firefly` hub-item, 40% it escapes. Day/night
  availability follows the species' normal spawn rules (§8).

Placed (named) animals keep their normal §8 quest/dialogue routing.

### Hub fishing (item-gated)

Hub fishing NPCs use `"screen": "hub-fishing"` (Millhaven harbour, Capital
City riverside, Ravenwatch pond). `handleNodeInteract` (HubWorld.tsx) blocks
entry without a `fishing-rod` or without holding at least one `fish-bait`;
both are global, so one rod works in every town. Entry does **not** consume
bait — each cast inside the minigame does. The screen renders
`<Fishing rewardMode="catch">` (App.tsx), which shows the live bait count in
its header and deducts one `fish-bait` (via `removeHubItem`) on every cast
("CAST!" / "TRY AGAIN" / "FISH AGAIN"); once bait hits 0, casting is disabled
and only "GIVE UP"/"DONE" remain to exit. The caught fish is added to the
inventory as a tier-keyed hub-item (`fish-tiddler` … `fish-legendary`) and
**no tickets are awarded**. The arcade fishing tile (MiniGamesMenu,
`"screen": "fishing"` nowhere in hub configs anymore) is unchanged, has no
bait cost, and still pays tickets.

### Authoring checklist: new shop good + trade chain

1. Add the item to `hubItems.json` (`category: 'material'`, or `'tool'` +
   `unique: true` for one-of-a-kind gear).
2. Sell it: add an interactable with a `buyHubItem` reaction — inside a shop
   building (pure `hitRect` over existing shelf decor, speaker auto-resolves)
   or as an exterior stall (owned `decor` + `speakerName`).
3. Give it a use: a `tradeHubItem` choice on another NPC's dialogue tree
   (ideally in a different town), and/or a world interaction that consumes it.
4. Run `npm run test` (loader tests parse all configs) and `npm run build`;
   verify buy → carry → trade end-to-end in-game and across a reload.

### Extending the network

Every previously-empty shop now sells a good and every good has a buyer (see
the network list above), but the graph is designed to keep growing: any new
`hubItems.json` entry only needs one `buyHubItem` seller and one
`tradeHubItem` buyer (per the authoring checklist above). Natural next links:
a downstream use for goods that currently dead-end at a crystal payout (e.g.
the poetry book could also be gifted to a romance-track NPC), multi-item
recipes (an NPC wanting an egg *and* a spice pouch), and pet-accessory
rewards on high-value trades.

## §17 — Trade Journal

A discovery-tracked record of hub-item sellers and buyers the player has
personally encountered — the item economy (§16) has grown large enough that
players need an in-game way to recall *where* a good is sold or *who* wants
it, without re-reading NPC dialogue. Mirrors the Town Journal's (§15)
shape/conventions exactly, but for trade instead of animals/people/places.

- Store: `web/src/game/hub/tradeJournal.ts`, localStorage key
  `jarv_hub_trade_journal`. Two lists, deduped by `itemId + town + speaker`:
  ```ts
  interface SellerEntry { itemId: string; town: string; speaker: string; price: number; currency: 'crystals' | 'tickets' }
  interface BuyerEntry  { itemId: string; town: string; speaker: string; rewardSummary: string }
  recordSellerSeen(entry): boolean   // true if newly recorded
  recordBuyerSeen(entry): boolean
  getKnownSellers(): SellerEntry[]
  getKnownBuyers(): BuyerEntry[]
  ```
  Fails closed (empty lists / no-op) if `localStorage` throws.
- UI: `TradeJournalModal.tsx`, opened from the 💱 toolbar button in
  `HubWorld.tsx` (next to 🎒 Inventory). Two sections — "Known Sellers" /
  "Known Buyers" — each row showing the item's catalog icon + name, the
  town/speaker, and the price or reward summary. Empty-state text per
  section until the player has discovered anything.
- Discovery timing (discovery-on-tap, not mere visibility — matches §15's
  rule for the Town Journal): a `buyHubItem` shelf records its seller the
  moment it's tapped, **before** any `prerequisite`/reputation check — so a
  locked shelf still reveals itself in the journal, just not yet
  purchasable. A `tradeHubItem` dialogue choice records its buyer the moment
  it's clicked, before the missing-goods check — so an attempted trade you
  can't yet complete still appears under Known Buyers.
- Because both hooks live in the two generic reaction/effect handlers, every
  seller and buyer from every round (§16's network list) populates the
  journal automatically the first time a player encounters them — no
  per-item retrofit needed.

---

## §18 — Home Layout (Player Housing)

The state/persistence layer for player housing customization: which pieces
of furniture are placed where in the player's home. This is the store only
— it has no UI (tracked separately, see below).

### Full schema

```json
{
  "placed": [
    { "id": "rug-1-1750000000000-a1b2c3", "itemId": "rug-1", "x": 2, "y": 3, "rotation": 0 }
  ]
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique **instance** id for this placement, generated by `placeFurniture` (`` `${itemId}-${Date.now()}-${rand}` ``). Not the same as `itemId`. |
| `itemId` | `string` | Furniture catalog id (§19). Must be a valid, **owned** catalog id — `placeFurniture` rejects anything else. |
| `x`, `y` | `number` | Grid cell of the piece's top-left corner, 0-indexed, bounded by `HOME_GRID_COLS` / `HOME_GRID_ROWS` (currently 8×6). |
| `rotation` | `0 \| 90 \| 180 \| 270` | Facing/orientation of the placed piece. At 90/270 the catalog def's `footprint.w`/`footprint.h` are swapped for bounds/occupancy checks. |

### Persistence — `web/src/game/hub/homeLayout.ts` (key `jarv_hub_home_layout`)

| Export | Purpose |
|---|---|
| `loadHomeLayout()` / `isHomeLayoutEmpty()` | Read current placements / check for none. |
| `placeFurniture(itemId, x, y, rotation?)` | Adds a new placement. Returns `null` if `itemId` isn't a catalog id the player owns (§19), the piece's footprint would go out of bounds, or it overlaps any cell of an existing piece. |
| `moveFurniture(id, x, y, rotation?)` | Relocates an existing placement. Returns `false` if the id is unknown, the target is out of bounds, or its footprint overlaps a *different* piece (moving onto its own current cell is allowed). |
| `removeFurniture(id)` | Deletes a placement by instance id. Returns `false` if unknown. |

`save()` calls `logError` on write failure (a lost decorated layout is
user-visible); `load()` fails open to an empty layout on any read/parse
error, matching every other hub store. Occupancy checks are region-based
(every cell of a multi-cell footprint blocks placement, not just its
origin cell) via the internal `footprintFor`/`overlaps` helpers.

### UI — `web/src/components/hub/HomeShelf.tsx`

`HomeShelf` (the `home-shelf` screen, reached with only an `onBack` prop —
no new `App.tsx` routing was needed) gained a **SHELF / DECORATE** tab row
(reusing `HallOfAchievements`/`TownJournal`'s `.hoa-tabs`/`.hoa-tab` CSS).
SHELF is the original read-only relic/keepsake display, unchanged. DECORATE
renders the grid, using three pure-visual pieces under
`web/src/components/hub/home-shelf/` (each with a `.stories.tsx`):

- `HomeGrid.tsx` — the `HOME_GRID_COLS × HOME_GRID_ROWS` grid; placed pieces
  span their (rotation-aware) footprint via `gridColumn`/`gridRow`.
- `FurniturePicker.tsx` — a horizontal strip over the full catalog; owned
  pieces are plain, unowned ones show a price tag.
- `PieceActionBar.tsx` — Rotate / Move / Remove for the selected piece.

**Interaction** is tap-to-arm, tap-to-place — no drag-and-drop (none exists
anywhere else in this codebase, and touch/tap matches every other hub
interaction): tapping an owned picker item arms it, then tapping an empty
grid cell calls `placeFurniture`; tapping a placed piece selects it and
shows `PieceActionBar` (Rotate re-calls `moveFurniture` with the next
rotation; Move arms the piece for relocation; Remove is a two-tap confirm,
copying `TowerDefence.tsx`'s sell-arm timeout pattern). Tapping an unowned
picker item opens a buy-confirm dialog (reusing `ShopScreen.tsx`'s
`.shop-confirm-*` classes) showing price vs. `loadCrystals()`; confirming
spends crystals inline (`saveCrystals`) then calls `grantFurniture`, same
as `HubWorld.tsx`'s `buyHubItem` case. A failed `placeFurniture`/
`moveFurniture` call (out of bounds/overlap) surfaces a brief inline
message rather than failing silently.

---

## §19 — Furniture Catalog & Ownership

The furniture catalog for player housing (§18): what pieces exist, their
grid footprint, and which ones the player owns. Global (not per-town),
following the `petAccessories.ts`/`hubItems.json` precedent.

### Full schema — `web/src/data/furniture.json`

```json
[
  { "id": "reading-lamp", "name": "Reading Lamp", "icon": "💡", "desc": "Warm light for late nights.", "footprint": { "w": 1, "h": 1 }, "price": 20 },
  { "id": "cozy-rug", "name": "Cozy Rug", "icon": "🟥", "desc": "A thick woven rug for cold floors.", "footprint": { "w": 2, "h": 2 }, "price": 30 }
]
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Catalog id. Referenced by `PlacedFurniture.itemId` (§18) and by `grantFurniture`/`ownsFurniture`. |
| `name`, `icon`, `desc` | `string` | Display fields for a future shop/decoration UI. |
| `footprint` | `{ w: number; h: number }` | Grid cells occupied (unrotated). §18's `placeFurniture`/`moveFurniture` swap `w`/`h` at 90°/270° rotation. |
| `price` | `number` | Crystal cost, for a future shop UI. This module does not spend currency itself — see below. |

### Persistence — `web/src/game/hub/furniture.ts` (key `jarv_hub_furniture_owned`, an owned-id array)

| Export | Purpose |
|---|---|
| `getFurnitureDef(id)` / `getAllFurnitureDefs()` | Catalog lookup (static data, no persistence). |
| `getOwnedFurnitureIds()` / `ownsFurniture(id)` | Read which catalog ids the player owns. |
| `grantFurniture(id)` | Idempotently grants ownership. Returns `false` if the id isn't in the catalog or is already owned. |

Same fail-open `load()` / `logError`-on-write-failure `save()` convention
as every other hub store. This module intentionally has **no** "buy"
function — spending crystals is done inline by the calling UI (matching
`HubWorld.tsx`'s `buyHubItem` reaction, which reads `loadCrystals()`,
checks the balance, and calls `saveCrystals()` itself rather than delegating
to the item store). A future shop/earn flow (#1646) calls `grantFurniture`
after handling its own currency check.
