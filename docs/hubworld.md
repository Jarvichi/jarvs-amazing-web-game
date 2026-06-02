# Hub World — Data Schemas & Agent Reference

> This document is the authoritative reference for hub world JSON authoring.
> Read it before editing `web/src/data/hub/config.json`,
> `web/src/data/hub/questDefs.json`, or any hub TypeScript files.

---

## §1 — File Map

| File | Owns | TypeScript exports |
|---|---|---|
| `web/src/data/hub/config.json` | Map geometry, buildings, doors, NPCs, exterior decor, interiors, windows | parsed by `loader.ts` |
| `web/src/data/hub/questDefs.json` | Quests, pickup items, blocked paths, inn rumours, friendship dialogue | parsed by `loader.ts` and `questDefs.ts` |
| `web/src/data/hub/loader.ts` | Parses both JSON files; exports all map/NPC/item/path data | `MAP_W`, `MAP_H`, `AVATAR_START`, `HUB_AREAS`, `HUB_STREET_TILES`, `HUB_BUILDINGS`, `HUB_DOORS`, `HUB_INTERIORS`, `EXTERIOR_DECOR`, `HUB_NPCS`, `EXTERIOR_NPCS`, `INTERIOR_NPCS`, `HUB_PICKUP_ITEMS`, `HUB_BLOCKED_PATHS`, `HUB_LOCKED_DOORS`, … |
| `web/src/data/hub/questDefs.ts` | Parses `questDefs.json`; exports quest definitions and dialogue | `HUB_QUEST_DEFS`, `INN_RUMOURS`, `FRIENDSHIP_DIALOGUE` |
| `web/src/game/hub/quests.ts` | Quest progress/status persistence (localStorage) | `getQuestState`, `setQuestStatus`, `incrementQuestProgress`, `getQuestProgress`, `resetQuest` |
| `web/src/game/hub/pickups.ts` | Pickup state persistence (localStorage) | `getPickedUpIds`, `markPickedUp`, `isPickedUp`, `unmarkPickedUp` |
| `web/src/game/hub/friendship.ts` | NPC friendship XP/level persistence (localStorage) | `getFriendshipLevel`, `addFriendshipXp`, `getFriendshipData` |
| `web/src/game/hub/innConvos.ts` | Inn conversation tracking (localStorage) | `getHeardConvoIds`, `markConvoHeard`, `isConvoHeard` |
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
