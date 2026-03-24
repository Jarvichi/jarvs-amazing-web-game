# Acts — Design Rules & Agent Reference

> This document defines how Acts, the campaign map, nodes, relics, heroes, and
> related systems work. It is the authoritative spec for agents implementing or
> modifying campaign content. Always read this before editing act JSON files or
> campaign TypeScript.

---

## Quick Implementation Status

| System | Implemented | Notes |
|---|---|---|
| Campaign map (rows, cols, branching) | ✅ | `questline.ts`, `acts/*.json` |
| Node types (battle/elite/boss/rest/event/merchant) | ✅ | See node types section |
| Mystery node | ❌ | Runtime surprise — see below |
| Node peek modal | ❌ | UI not built |
| 25-act campaign | ❌ | Only 4 acts exist |
| Second 25-act story arc | ❌ | Future |
| Replay text variants | ✅ | `introRules`, `variantPools`, `midRunTemplates` |
| Global word substitution config | ❌ | Not yet a file |
| Per-run modifiers | ❌ | Not applied |
| Relic breaking | ❌ | 50% break on act-end screen |
| Relic pick screen (start of act) | ❌ | Currently auto-equips last earned |
| Boss card (boss node mechanic) | ❌ | Opponent keeps playing normally |
| Boss traits (burrow/fly/split/jump AOE/column AOE) | ❌ | Designed in `bossAIs.json`; engine not built — see §13 |
| Hero card per act | ❌ | Pool exists but no per-act additions |
| Lives system (3 lives) | ❌ | Only HP exists, no lives count |
| Campaign failed screen | ❌ | Not implemented |
| Per-run handicap reduction on loss | ❌ | Not implemented |
| Per-act music in JSON | ❌ | No music field in act schema |
| Card lore fields | ❌ | Cards have no `lore` property |
| 25+ act-themed card sets (25 cards min per act) | ❌ | ~95 total cards across all acts |

---

## 1. Campaign Map

### 1.1 Map Layout

The act map is a series of **rows**, read bottom-to-top (row 0 = first, boss = last).

**Row width pattern:**
- Row 0 always has **1 node** (the starting node).
- Subsequent rows alternate between **1 node** and **3 nodes** (occasionally **5 nodes** — rare, may require layout code changes).
- The final row always has **1 node** — the Boss node.

**Example layout (7 rows):**
```
Row 6: [Boss]
Row 5: [A] [B] [C]
Row 4: [D]
Row 3: [E] [F] [G]
Row 2: [H]
Row 1: [I] [J] [K]
Row 0: [Start]
```

**Example layout (9 rows):**
```
Row 8: [Boss]
Row 7: [A] [B] [C]
Row 6: [A] [B] [C] [D] [E]
Row 5: [A] [B] [C]
Row 4: [D]
Row 3: [E] [F] [G]
Row 2: [H]
Row 1: [I] [J] [K]
Row 0: [Start]
```

### 1.2 Path Branching

Branching is encoded in `parentIds` / `childIds` on each `QuestNode`. Any topology is supported — including the scenario where a 3-node row fans into a 5-node row:

```
Row N (3 nodes):  [1A]       [1B]         [1C]
                  ↓  ↘       ↓  ↘  ↘      ↙  ↘
Row N+1 (5 nodes): [2A] [2B] [2B] [2C] [2D]  [2D] [2E]
```

> **Note:** 5-node rows require verifying that the `NodeMap` UI component handles `rowCols: 5`. Check `web/src/components/NodeMap.tsx` before authoring such a row.

When a player picks one node from a set of siblings (nodes sharing a parent), all other siblings are marked **skipped** via `skipSiblings()` in `questline.ts`. Skipped nodes are not reachable for the rest of the run.

### 1.3 Node Data Shape (`QuestNode`)

```typescript
interface QuestNode {
  id: string
  type: NodeType          // see §2
  label: string           // short display name e.g. "Goblin Raid"
  description: string     // flavour text shown in the peek modal
  row: number             // 0 = start, ascending toward boss
  col: number             // column index within this row (0-based)
  rowCols: number         // total columns in this row (for UI layout)
  parentIds: string[]     // node IDs that lead into this one
  childIds: string[]      // node IDs this leads to
  handicap?: number       // battle difficulty offset
  restHeal?: number       // HP healed (rest nodes only)
  bossAI?: string         // AI strategy key e.g. 'thornlord'
  eventId?: string        // key into EVENT_CATALOG for event nodes
  bossDialogue?: string[] // lines boss speaks before battle
  enemyDeck?: string[]    // preset opponent card list (deterministic)
  environment?: string    // battlefield background theme
  opponentIntervalMs?: number  // override opponent play speed
  opponentBaseHp?: number      // override opponent base HP
}
```

Act JSON files live in `web/src/data/acts/act{N}.json` and are imported in `questline.ts`.

---

## 2. Node Types

### 2.1 Normal Battle (`type: "battle"`)
- Standard combat against an AI opponent.
- **Reward:** 1 random card (1 common drawn from act-themed pool).
- Includes a preset `enemyDeck` in the act JSON to make each node learnable.

### 2.2 Elite Battle (`type: "elite"`)
- Harder opponent, often with a named AI or higher-HP base.
- **Reward:** Pick 1 of 3 cards (skewed toward rare/uncommon).

### 2.3 Boss Node (`type: "boss"`)
- The final node of every act.
- The opponent uses a named `bossAI` strategy (e.g. `thornlord`).
- **Boss Card mechanic (❌ not implemented):**
  - Instead of a hero card, the opponent gets a **boss card** at battle start.
  - The boss card is NOT played during normal turns.
  - When the opponent's base HP reaches 0, instead of losing, the boss card activates: the opponent's base is **restored to full HP** and the boss unit is deployed onto the field.
  - The boss unit has very high HP and unique stats. The player must defeat it to win.
- **Reward:** Shard relic + pack of cards + crystals.

### 2.4 Rest / Camp (`type: "rest"`)
- No battle. Player heals HP.
- `restHeal` in JSON sets the heal amount (default: 5 HP).
- Rest nodes should appear **more frequently near the boss** row to give players recovery before the final fight.

### 2.5 Event (`type: "event"`)
- Text-adventure style choice. The player sees a title, description, and 2–4 choices.
- Each choice has a `label`, `consequence` (displayed after pick), and an `effect`.
- **Effects:** `healHp`, `damageHp`, `gainCrystals`, `gainCard`, `gainItem`, `nothing`.
- Events are identified by `eventId`, which must match an entry in `events.json` or one of the generator functions (`generateShrineEvent`, `generateRuinsEvent`) in `questline.ts`.
- Results should be **random** (one option can be negative — e.g. lose HP).
- See the **Campaign Event Checklist** in `AGENTS.md` when adding new events.

### 2.6 Merchant (`type: "merchant"`)
- Player spends crystals to buy cards.
- `generateMerchantCards()` returns 3 cards (1 common, 1 uncommon, 1 rare, shuffled).
- Prices per rarity defined in `MERCHANT_PRICES` in `questline.ts`.
- **Rarely** the merchant should also offer an inventory/relic item (❌ not implemented).

### 2.7 Mystery Node (❌ not implemented)
- **Not configured in act JSON.** Determined at runtime when the act begins.
- At act start, randomly pick N normal battle nodes to silently replace with mystery nodes. The **map UI continues to display them as normal battle nodes** — the player has no way to know.
- When the player selects the node, instead of a battle they see:
  - The battlefield with **dead enemies already on the field** (cleared combat state).
  - A **reward chest** granting a battle-tier reward.
  - Lore text: *"Whoops, we forgot to clean up after the last battle — here's a reward anyway."*
- The mystery node is marked complete after the player claims the chest (no combat).

---

## 3. Node Peek (❌ not implemented)

Every node should support a **peek** interaction before the player commits:

1. Player **taps a node** on the map → a **modal** appears.
2. Modal shows:
   - Node type icon + label.
   - Potential reward summary (e.g. "1 random card", "Pick 1 of 3 rare cards").
   - For battle/elite: **opponent difficulty hint** (handicap level).
3. If the player has **already completed** this node in a previous run, the modal additionally shows:
   - The opponent's deck card list.
   - The opponent's play-style description.
4. Two buttons: **"Enter Battle"** (confirm) and **"Back"** (dismiss modal).

---

## 4. Story & Lore

### 4.1 Campaign Structure

The full campaign consists of **25 acts** that tell a complete story arc. After act 25 the story ends and a **second 25-act arc** begins, set in the same game world, dealing with the aftermath and introducing a new plot. Each 25-act block is self-contained.

Current implementation has **4 acts** (Act 1–4). Acts 5–25 are yet to be written.

### 4.2 Story Continuity Rules

When writing act lore:
- Each act **advances the main storyline** — the Fractured Dominion, Jarv's quest, the mystery of the Fracture Event.
- Lore must be **accurate and consistent** with prior acts. Read existing `intro` and `outro` panels before writing new ones.
- Boss dialogue (`bossDialogue[]` in the node) must fit the act's tone and the boss's character.
- Act `outro` panels describe the aftermath of beating the boss and tease the next act.

### 4.3 Act JSON Fields for Story

| Field | Purpose |
|---|---|
| `intro` | Panels shown on the **first run** of this act (or if no rule matches). |
| `outro` | Panels shown **every time** the boss is defeated. |
| `introRules` | Ordered list of run-count rules for alternate intro panels on replays. |
| `variantPools` | Named arrays of alternate phrases — referenced as `{pool:name:offset}` in panel text. |
| `midRunTemplates` | Sentences selected by `n % length`; injected via `{midRunTemplate}` tag. |

### 4.4 Substitution Tags (in panel `title` / `text`)

| Tag | Resolves to |
|---|---|
| `{n}` | Current run count as a number |
| `{ORDINAL}` | Ordinal word in caps: `FIFTH`, `TWELFTH`, etc. |
| `{ordinalLower}` | Same but lowercase |
| `{midRunTemplate}` | Entry from `midRunTemplates[n % length]` |
| `{pool:name:offset}` | Seeded pick from `variantPools[name]` — stable per (n, offset) pair |

> A **global word substitution config** (❌ not implemented) should also exist as a separate JSON file holding single-word alternates (e.g. `"enemy"` → `["foe", "opponent", "adversary"]`) usable in any act's text.

---

## 5. Replaying an Act

### 5.1 Run Count

`jarv_run_count` in localStorage tracks total campaign runs. `loadRunCount()` / `incrementRunCount()` manage it.

### 5.2 Alternate Intro Text

`resolveActIntro(act, n)` in `questline.ts` picks panels based on `introRules`:
- Rules are evaluated in order; the first matching rule wins.
- If no rule matches (or `n <= 1`), falls back to `act.intro`.
- Placeholders are resolved via `resolvePlaceholders()`.

**Boss replay lines:** `bossDialogue[]` on the boss node should include run-aware variants, e.g.:
```json
["This is the {n}th time we've battled. This time I'll win!"]
```
(Tag support in `bossDialogue` is ❌ not yet implemented — currently plain strings.)

### 5.3 Per-Run Modifiers (❌ not implemented)

Each additional playthrough of an act should apply an escalating modifier that alters gameplay. Examples:
- Enemies gain +X% HP.
- Opponent mana regenerates faster.
- Increased crystal / card rewards.

Modifiers should be configured in the act JSON (e.g. a `replayModifiers` array), selected by `(runCount - 1) % modifiers.length`.

---

## 6. Relics

### 6.1 Earning Relics

Each act grants one **relic** on boss completion. The relic is stored in `jarv_relics` (localStorage) and in `RunState.activeRelic`.

Current relics: Bark Shield (Act 1), Iron Standard (Act 2), Soulstone (Act 3), Prism Lens (Act 4). Each new act must add one relic to `web/src/game/relics.ts`.

### 6.2 Relic Selection (start of act — ❌ not implemented)

Before beginning an act (or after the previous act's completion screen), the player should be shown a **relic selection screen**:
- Display all relics the player has earned (from `loadEarnedRelics()`).
- Player picks **1 relic** to take into the run.
- Selected relic is set as `RunState.activeRelic`.

Currently the game auto-equips the last earned relic.

### 6.3 Relic Breaking (❌ not implemented)

When the act-completion screen shows the relic earned:
- **50% chance** the relic **breaks** immediately.
- Broken relics are **unusable** and displayed as greyed-out items in the inventory.
- The player can **re-earn** a broken relic by completing the act that originally awarded it again (which also resets the break chance).

### 6.4 Relic Effects in Engine

`getRelicDef(name).applyToGame(state)` is called at battle start in `App.tsx`. Each relic modifies `GameState` fields. See `web/src/game/relics.ts`.

---

## 7. Heroes

### 7.1 Hero Cards in Battle

Hero cards are dealt **one at random** to the player at the start of each battle. They can be used **once per battle**. The pool of available hero cards grows with each act.

**New acts must add at least one hero card to the hero pool.** The hero pool is defined in the cards system — search for `type: 'hero'` in `web/src/data/cards.json`.

### 7.2 Boss Node — Boss Card (❌ not implemented)

At boss nodes, the **opponent does NOT get a hero card**. Instead they have a **boss card**:

- The boss card is not played during normal turns.
- When the opponent's base reaches 0 HP (normally a loss), instead:
  1. Opponent base HP **fully restores**.
  2. The **boss unit** is deployed onto the battlefield.
  3. The boss unit has very high HP and unique abilities.
  4. The player must destroy the boss unit to win.
- This mechanic should be triggered in the combat engine when `opponent.hp <= 0` and a boss card is present.

Implementation notes:
- Add a `bossCard?: string` field to `QuestNode`.
- Add a `bossCardActive: boolean` flag to `GameState`.
- In `engine.ts`, intercept the normal game-over check when the boss card hasn't fired yet.

---

## 8. Lives System (❌ not implemented)

### 8.1 Starting Lives

The player begins each campaign with **3 lives** (separate from HP).

### 8.2 Losing a Battle

- Player loses 1 life.
- HP is preserved (or reduced by a configurable amount).
- Player is returned to the node map.
- Player can **modify their deck** before retrying the same node.

### 8.3 Campaign Failed

When the player has **0 lives** and loses a battle:
- **Campaign Failed** screen is shown.
- A **reduced reward** (small crystal amount) is granted.
- The loss is logged (node ID + act ID + run count).
- On the **next run**, a **handicap reduction** is applied to that node to make it slightly easier. This is the game's way of teaching the player the node's style without removing the challenge entirely.

### 8.4 Storage

Lives should be stored in `RunState` (add `livesRemaining: number` field). Default: 3.

---

## 9. Cards (Per-Act)

### 9.1 Act-Themed Card Sets

Each act introduces **at least 25 new cards** themed to its environment (cave, forest, city, jungle, etc.). These cards can **only be earned within that act** (not from other acts, except via daily login rewards, crystal purchases, or quick-play rewards).

Each card must have:
- `name`, `cost`, `rarity`, `type` (unit / structure / upgrade)
- `lore` field (❌ not currently in schema) — short flavour text
- A corresponding SVG sprite (see sprite rules in `AGENTS.md`)
- A `tags` array matching the act's `rewardTags` (e.g. `["forest"]`)

### 9.2 Reward Tags

`act.rewardTags` in the act JSON drives weighted card reward generation. Cards matching any act tag appear 3× more often in post-battle reward pools. Set this to the act's theme(s).

---

## 10. Music (❌ not implemented)

Each act should have its own background music track, configured in the act JSON.

**Proposed act JSON fields:**
```json
{
  "music": {
    "mapTrack": "verdant-map.mp3",
    "battleTrack": "verdant-battle.mp3",
    "bossTrack": "verdant-boss.mp3"
  }
}
```

Music assets should live in `web/public/audio/`. The act `music` object should be read when entering an act map or battle and passed to the sound system (`web/src/game/sound.ts`).

---

## 11. JSON Configuration Principles

As much campaign behaviour as possible is configured in JSON, not TypeScript:
- Act node maps: `web/src/data/acts/act{N}.json`
- Event catalog and pools: `web/src/data/events.json`
- Card definitions: `web/src/data/cards.json`

**Not yet in JSON (should be migrated):**
- Global word substitution table (single-word alternates usable in any act text).
- Per-run modifiers.
- Relic definitions (currently hardcoded in `relics.ts`).
- Music configuration (not yet a field).

When adding new behaviour, **prefer extending the JSON schema** over adding TypeScript logic, so future act authors only need to edit JSON.

---

## 13. Boss Traits

Each boss has a single unique **trait** — a dramatic ability that fires mid-battle and changes the shape of the fight. Traits are defined in `bossAI` entries inside `web/src/data/bossAIs.json` as a `trait` object alongside the normal phase config. They are **not yet implemented** in the engine (see Quick Implementation Status table), but the full mechanical spec lives in JSON so the system can be built without needing to revisit the design.

### 13.1 Trait Object Schema

```json
{
  "name": "Short display name",
  "implemented": false,
  "trigger": "hp_pct | hp_pct_multi | periodic | game_time_gte",
  "triggerHpPct": 50,          // used with "hp_pct"
  "triggerHpPcts": [66, 33],   // used with "hp_pct_multi" (fires at each threshold once)
  "triggerIntervalMs": 30000,  // used with "periodic"
  "triggerGameTimeMs": 120000, // used with "game_time_gte" (fires once)
  "type": "burrow | fly | split | jump_aoe | column_aoe",
  "description": "Full design description shown in codex / debug UI.",
  "mechanics": { ... },        // type-specific numbers (see §13.2)
  "announceText": "Log line shown when the trait activates.",
  "landText": "Log line shown when the boss lands / resolves."
}
```

### 13.2 Trait Types & Mechanics Fields

| Type | What happens | Key `mechanics` fields |
|---|---|---|
| `burrow` | Boss sinks underground (untargetable) then resurfaces at a new position | `invulnerableDurationMs`, `landingDamage`, `landingRadiusTiles`, `repositionTarget` |
| `fly` | Boss flies into the air (invulnerable) then descends with an effect | `invulnerableDurationMs`, `landingDamage`, `landingRadiusTiles`, `repositionTarget` |
| `split` | Boss splits into N copies each with 1/N HP; all must be killed | `splitCount`, `hpDivisor`, `positions`, `allMustDie` |
| `jump_aoe` | Boss leaps and crashes down on the player's side, dealing AOE damage | `jumpDurationMs`, `landingDamage`, `landingRadiusTiles`, `stunDurationMs`, `landingTarget` |
| `column_aoe` | Boss fires a pulse that damages one entire column of the battlefield | `pulseDamage`, `pulseColumn`, `slowDurationMs`, `slowFactor`, `chargeUpMs` |

**`repositionTarget` / `landingTarget` values:**
- `"random"` — random valid position on the full battlefield
- `"player_side_random"` — random position on the player's half
- `"opposite_flank"` — the opposite horizontal flank from where the boss started
- `"nearest_player_highest_hp"` — adjacent to the player's current highest-HP unit
- `"player_densest_cluster"` — position with the most player units within 2 tiles
- `"battlefield_centre"` — fixed centre tile

### 13.3 Boss Trait Reference

| Boss | Trait | Trigger | Summary |
|---|---|---|---|
| Thornlord | **Burrow** | 50% HP | Sinks underground (3 s invuln), resurfaces at random spot, 5 AOE dmg in 2-tile radius |
| Warlord Kragg | **Earthshaker** | Every 30 s | Leaps and crashes on the player's side — 8 AOE dmg, 1.5 s stun in 2-tile radius |
| The Ashwalker | **Ashen Split** | 50% HP | Dissolves into 3 copies each with ⅓ HP scattered across the field; all must be killed |
| The Archivist | **Arcane Ascension** | 120 s (mana phase) | Flies up (5 s invuln), descends in arcane burst that silences all player units for 3 s |
| Tidal Sovereign | **Riptide Surge** | 50% HP | Dives into the depths (3 s invuln), resurfaces with a wave — 3 dmg + pushes units 3 tiles |
| The Pale Engine | **Overload Cascade** | Every 45 s | EMP pulse down a random column — 6 dmg to all units in that column, 50% slow for 4 s |
| The Dune Baron | **Sand Dive** | 66% & 33% HP | Dives into sand (2 s invuln), surfaces next to player's highest-HP unit — 4 AOE dmg, 2 s disorientation |
| The Root Queen | **Mycelium Fracture** | 40% HP | Splits into 4 Spore Nodes at the four corners (25% HP each); each spawns crawlers; all must die |
| Cinderwarlord | **Caldera Leap** | Every 40 s | Leaps into a volcano (4 s invuln), crashes down as a meteor — 10 AOE dmg in 3-tile radius, 5 s burn zone |
| The Cloudmarshal | **Storm Dive** | 60% HP | Ascends (6 s invuln), dives onto player's densest cluster — 7 AOE dmg, 6 s storm zone (2 dmg/s) |

### 13.4 Implementation Notes (for the developer building this)

- Add a `bossTraitState` field to `GameState` to track per-boss trait progress (thresholds fired, cooldowns).
- In the combat loop (`engine.ts`), after each damage tick to the boss, check trait trigger conditions.
- For `hp_pct` / `hp_pct_multi`: fire once per threshold, guard with a `firedThresholds: number[]` set.
- For `periodic`: track `lastTraitFireTime` and fire when `gameTime - lastTraitFireTime >= triggerIntervalMs`.
- For `game_time_gte`: fire once when `gameTime >= triggerGameTimeMs`, guard with `traitFired: boolean`.
- During the `invulnerableDurationMs` window, skip the boss in all targeting / damage calculations.
- `split` traits should spawn synthetic boss units; the win condition changes to "all split units dead".
- Log `announceText` when the trait activates and `landText` (or `surfaceText` / `splitLog`) when it resolves.
- Set `"implemented": true` in the JSON once a trait is live.

---

## 12. Act Authoring Checklist

When creating a new act JSON (`web/src/data/acts/act{N}.json`):

- [ ] `id`, `title`, `subtitle`, `environment`, `rewardTags` set.
- [ ] `startNodeIds` points to the first node (row 0, col 0).
- [ ] All nodes have valid `parentIds` / `childIds` (acyclic, reachable from start).
- [ ] Boss node (`type: "boss"`) exists and is reachable.
- [ ] `rewardRelic` + `rewardRelicDesc` match an entry in `relics.ts`.
- [ ] New relic added to `web/src/game/relics.ts` if new.
- [ ] At least one new hero card added to the hero pool.
- [ ] At least 25 act-themed cards exist in `cards.json` with matching `tags`.
- [ ] All sprites for new cards/units/buildings exist in `web/public/sprites/`.
- [ ] All `eventId` values checked against `AGENTS.md` Campaign Event Checklist.
- [ ] `intro`, `outro`, `introRules`, `variantPools`, `midRunTemplates` authored (see §4).
- [ ] Boss node has `bossDialogue` lines (including a run-aware variant).
- [ ] Boss entry in `bossAIs.json` has a unique `trait` object (see §13 for schema and examples).
- [ ] `music` fields added (once music system is implemented).
- [ ] Act registered in `ACTS` map and `getNextAct()` in `questline.ts`.
- [ ] Run `npm run build` from `web/` — must pass with no TypeScript errors.
