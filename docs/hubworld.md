# Hub World — Data Schemas & Agent Reference

> This document is the authoritative reference for hub world JSON authoring.
> Read it before editing `web/src/data/hub/config.json`,
> `web/src/data/hub/questDefs.json`, or any hub TypeScript files.

---

## §1 — File Map

| File | Owns | TypeScript exports |
|---|---|---|
| `web/src/data/hub/config.json` | Map geometry, buildings, doors, NPCs, exterior decor, interiors, windows, interactables | parsed by `loader.ts` |
| `web/src/data/hub/questDefs.json` | Quests, pickup items, blocked paths, inn rumours, friendship dialogue | parsed by `loader.ts` and `questDefs.ts` |
| `web/src/data/hub/loader.ts` | Parses both JSON files; exports all map/NPC/item/path data | `MAP_W`, `MAP_H`, `AVATAR_START`, `HUB_AREAS`, `HUB_STREET_TILES`, `HUB_BUILDINGS`, `HUB_DOORS`, `HUB_INTERIORS`, `EXTERIOR_DECOR`, `HUB_NPCS`, `EXTERIOR_NPCS`, `INTERIOR_NPCS`, `HUB_PICKUP_ITEMS`, `HUB_BLOCKED_PATHS`, `HUB_LOCKED_DOORS`, … |
| `web/src/data/hub/questDefs.ts` | Parses `questDefs.json`; exports quest definitions and dialogue | `HUB_QUEST_DEFS`, `INN_RUMOURS`, `FRIENDSHIP_DIALOGUE` |
| `web/src/game/hub/quests.ts` | Quest progress/status persistence (localStorage) | `getQuestState`, `setQuestStatus`, `incrementQuestProgress`, `getQuestProgress`, `resetQuest` |
| `web/src/game/hub/pickups.ts` | Pickup state persistence (localStorage) | `getPickedUpIds`, `markPickedUp`, `isPickedUp`, `unmarkPickedUp` |
| `web/src/game/hub/friendship.ts` | NPC friendship XP/level persistence (localStorage) | `getFriendshipLevel`, `addFriendshipXp`, `getFriendshipData` |
| `web/src/game/hub/innConvos.ts` | Inn conversation tracking (localStorage) | `getHeardConvoIds`, `markConvoHeard`, `isConvoHeard` |
| `web/src/game/hub/interactables.ts` | Interactable grant + moved-position persistence (localStorage) | `interactableStoreKey`, `isInteractableGranted`, `markInteractableGranted`, `getInteractableMoves`, `setInteractableMove` |
| `web/src/game/hub/animals.ts` | Pure animal logic (spawn ratios/caps, tint palettes, behaviour tables) | `computeProceduralCounts`, `resolveVariantTint`, `pickWeighted`, `ANIMAL_RATIOS`, `ANIMAL_CAPS` |
| `web/src/components/hub/hubAnimals.ts` | PixiJS animal manager — spawns & ticks cats/dogs/birds/fish | `createAnimalSystem` |
| `web/src/components/hub/HubTownCanvas.tsx` | PixiJS canvas — rendering, pathfinding, walk, interactions | — |
| `web/src/components/hub/HubWorld.tsx` | React orchestrator — quest flow, dialogue, state | — |

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
| `blockedTiles` | `[number, number][]` | ✓ | Array of `[tx, ty]` hub tile coordinates removed from pathfinding while the quest is incomplete. **Must already exist in `config.json` streets** — they become walkable again on clear. |
| `questId` | `string` | ✓ | Quest ID from the `quests` array in `questDefs.json`. The path clears the moment this quest reaches `completed` status (checked at walk-start time, so no reload needed). |
| `blocked` | `BlockedPathState` | ✓ | Visual state while quest is incomplete. |
| `cleared` | `BlockedPathState` | ✓ | Visual state once quest is complete. Can be empty `{}` if nothing changes visually. |

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
| `screen` | `screen` | Opens a screen via the same routing as NPC `screen` (e.g. `news`, `shop`, `interior:<id>`, minigame ids). |
| `giveItem` | `collectible?`, `consumables?`, `crystals?`, `message?`, `alreadyGrantedText?` | One-time grant (persisted). Re-taps show `alreadyGrantedText` if set. Reward shapes match treasure rewards. |
| `quest` | `questId`, `speakerName?` | Offers the quest with Accept / Not now. The quest's `giverNpcId` in `questDefs.json` **must equal the interactable's id**. Honours prerequisites and the 2-active-quest cap. |
| `move` | `to: {tx, ty}`, `message?` | Moves the owned decor to the target tile, live and persisted across reloads. Requires owned `decor`. |

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

---

## §8 — Animals (cats, dogs, birds, fish)

Living town ambience. Two kinds: **procedural** animals (spawned from town
geometry, anonymous, flavour-only) and **placed** animals (defined in
`config.json`, stable `id`, can give/receive quests). The PixiJS manager is
`createAnimalSystem` in `web/src/components/hub/hubAnimals.ts`; the pure maths
and behaviour tables live in `web/src/game/hub/animals.ts`.

### Procedural spawn ratios & caps

| Animal | Count | Source | Cap |
|---|---|---|---|
| Cats | 1 per 4 buildings | `HUB_BUILDINGS.length` | 6 |
| Dogs | 1 per 4 NPCs | exterior NPC count | 8 |
| Birds | 4 per town (fixed) | — | 4 |
| Fish | 1 per 6 pond tiles | `HUB_POND_TILES.length` | 12 |

Counts come from `computeProceduralCounts`. All towns get cats/dogs/birds
automatically; fish appear only where `pondTiles` exist.

### Behaviours

- **Cat** — lazy: mostly `sleep`/`sit`, only rousing for a stimulus — a dog to
  flee, a bird to chase, another cat to play with (♪), or an NPC who might feed
  them (?). Cats roam **off the paths onto grass**, stepping one tile at a time
  around solid tiles (buildings/ponds) toward a `goal` beacon (greedy nav, not
  the street pathfinder), and pad to a quiet grass spot to curl up.
- **Dog** — picks a named-NPC `owner`; `follow-owner / roam`, chases wandering
  cats, and reacts to *new* NPCs it meets by rolling like/dislike → wag (♥) or
  bark ("Woof!").
- **Bird** — `perched` on roof ridges or empty path tiles; flees everything by
  flying off-screen and re-pitching at a new empty spot.
- **Fish** — gentle swim constrained to pond tiles, with a sine bob.

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
exit. Cats navigate to their door outside with the grass-capable greedy stepper;
dogs use the street pathfinder.

Placed animals with `roam !== true` are **stationary**: they do not wander or
flee, so the player can always reach them to tap (important for quest givers,
especially birds, which otherwise flee on approach).

### Colour variants

One neutral-grey base SVG per type (`animal-cat`, `animal-dog`, `animal-bird`,
`animal-fish`, with `-1/-2/-3` walk/fly frames and `animal-cat-sleep`),
recoloured at spawn via `sprite.tint`. `variant` may be a palette key
(`TINT_PALETTES`, e.g. `"orange"`, `"brown"`, `"grey"`) or a hex string
(`"#e8923c"`); omit it for a random palette colour.

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
