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
| `web/src/game/hub/friendship.ts` | NPC friendship XP/level persistence (localStorage) | `getFriendshipLevel`, `addFriendshipXp`, `getFriendshipData` |
| `web/src/game/hub/relationships.ts` | NPC relationship-track (ally/rival/romance) persistence (localStorage) — see §7c | `getRelationship`, `getRelationshipTrack`, `getRelationshipLevel`, `addRelationshipPoints`, `relationshipProgress` |
| `web/src/game/hub/dialogueFlags.ts` | Branching-dialogue flag + "seen" branch persistence (localStorage) — see §7b | `setDialogueFlag`, `hasDialogueFlag`, `getDialogueFlags`, `markNodeSeen`, `hasNodeSeen` |
| `web/src/game/hub/innConvos.ts` | Inn conversation tracking (localStorage) | `getHeardConvoIds`, `markConvoHeard`, `isConvoHeard` |
| `web/src/game/hub/interactables.ts` | Interactable grant + moved-position persistence (localStorage) | `interactableStoreKey`, `isInteractableGranted`, `markInteractableGranted`, `getInteractableMoves`, `setInteractableMove` |
| `web/src/game/hub/animals.ts` | Pure animal logic — `ANIMAL_SPECS` registry (per-type data), spawn maths, tint resolution | `ANIMAL_SPECS`, `computeProceduralCounts`, `resolveVariantTint`, `ANIMAL_CAPS`, `TINT_PALETTES` |
| `web/src/components/hub/hubAnimals.ts` | PixiJS animal manager — spawns & ticks all animal types | `createAnimalSystem` |
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

## §7b — Branching Dialogue Trees

Reusable multi-choice NPC conversations that branch to different endings.
Authored in `questDefs.json` under a top-level `dialogues` array and attached to
an NPC via `dialogueTree` (the id of the tree). When such an NPC is tapped and has
no higher-priority interaction (quest offer/completion, screen, friendship-tier
line), `HubWorld.tsx` walks the tree instead of the linear `dialogue` cycle.

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

#### `DialogueEffect` types
| `type` | Fields | Behaviour |
|---|---|---|
| `flag` | `flag` | Persist a named dialogue flag. |
| `friendship` | `npcId?`, `xp` | Grant friendship XP (defaults to the speaking NPC). |
| `relationship` | `npcId?`, `track`, `points` | Add points to a relationship track (`ally`/`rival`/`romance`) — defaults to the speaking NPC. See §7c. |
| `quest` | `questId` | Offer that quest (Accept / Not now). Resolves the quest's real `giverNpcId`. **Terminates** the walk. |
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
