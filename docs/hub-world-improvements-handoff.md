# Hub World Improvements — Issue Creation Handoff

> **Why this file exists:** The task was to raise GitHub issues + sub-tasks for
> 20 hub-world improvements. The epic and the first 15 child issues were created
> successfully, but the GitHub MCP connection dropped mid-run and could not be
> re-authorized in that session. This document captures everything still
> outstanding so a fresh session (with working GitHub auth) can finish without
> re-deriving anything. **Delete this file once all issues are created.**

Repo: `Jarvichi/jarvs-amazing-web-game`. Labels in use: `feature` (large new
system), `enhancement` (additive gameplay), `improvement` (polish/QoL).
Sub-issues are nested via the GitHub sub-issue API (`mcp__github__sub_issue_write`,
`sub_issue_id` = the issue's **database id**, not its number).

---

## ✅ Already created

| # | Issue | Label | DB id |
|---|---|---|---|
| Epic | **#1602** [Epic] Hub World — 20 improvements | `feature` | 4660647700 |
| 1 | #1603 Hub: ambient music + sound effects | `feature` | 4660649069 |
| 2 | #1604 Hub: weather system (rain/snow/fog/wind) | `enhancement` | 4660650055 |
| 3 | #1605 Hub: seasonal & festival events | `enhancement` | 4660650482 |
| 4 | #1606 Hub: photo mode | `improvement` | 4660650739 |
| 5 | #1607 Hub: minimap + quest objective markers | `improvement` | 4660651128 |
| 6 | #1608 Hub: fast-travel waypoints | `improvement` | 4660651756 |
| 7 | #1609 Hub: town directory / "Where is…?" NPC locator | `improvement` | 4660652001 |
| 8 | #1610 Hub: movement feel — click-hold walk + sprint | `improvement` | 4660652361 |
| 9 | #1611 Hub: branching NPC dialogue trees | `feature` | 4660652825 |
| 10 | #1612 Hub: gift-giving to NPCs | `enhancement` | 4660653208 |
| 11 | #1613 Hub: relationship tracks (ally/rival/romance) | `enhancement` | 4660653821 |
| 12 | #1614 Hub: NPC daily-life depth (schedule-driven activities) | `enhancement` | 4660654160 |
| 13 | #1615 Hub: repeatable bounty board | `enhancement` | 4660654534 |
| 14 | #1616 Hub: pet adoption & follower companion | `enhancement` | 4660654935 |
| 15 | #1617 Hub: bestiary / town journal | `enhancement` | 4660655177 |

**Outstanding for these 15:** none of #1603–#1617 are yet linked as sub-issues
of the epic, and none have their sub-task sub-issues created. See the two
sections below.

---

## ⬜ Remaining parent issues to create (items 16–20)

Create each with `method: create`, owner `Jarvichi`, repo
`jarvs-amazing-web-game`, then link as a sub-issue of epic #1602.

### 16. Town reputation & building upgrades — label `feature`
**Title:** `Hub: town reputation & building upgrades`

```
Sub-issue of #1602 (Hub World epic).

## Why
The town is static — buildings never change. Letting the player invest crystals to
upgrade buildings (unlocking new services, decor, or shop stock) gives the hub a
sense of progression and a crystal sink.

## What to build
- A reputation/standing value per town and per-building upgrade levels with escalating
  crystal costs; upgrades unlock services (e.g. better shop stock, new interior decor,
  faster bounties) and visibly change the building.
- An upgrade UI (spend crystals, show next-level benefit) reachable from the building.

## Files
- `web/src/game/hub/` (new `reputation.ts` + upgrade definitions), `HubWorld.tsx`/`HubTownCanvas.tsx`
- `web/src/data/hub/<town>/config.json` (per-building upgrade data), `docs/hubworld.md`

## Acceptance criteria
- Spending crystals upgrades a building and unlocks at least one visible service/decor change.
- Reputation + upgrade levels persist; `npm run build` + tests pass.

Sub-tasks tracked as sub-issues.
```

### 17. Player housing customization — label `feature`
**Title:** `Hub: player housing customization`

```
Sub-issue of #1602 (Hub World epic).

## Why
The `home-shelf` screen displays collectibles but is view-only. Turning the home into
a decoratable space gives players self-expression and a reason to collect furniture.

## What to build
- A home interior the player can decorate: place/move/remove furniture and display relics
  on a grid, with a persisted layout.
- A furniture catalog (earned/bought) and an edit mode toggle.

## Files
- `web/src/components/hub/` (extend `HomeShelf.tsx` into an editable interior + story)
- `web/src/game/hub/` (new home-layout store), furniture catalog data; `docs/hubworld.md`

## Acceptance criteria
- Player can place/move/remove furniture; layout persists across reloads.
- Storybook story for the edit mode; `npm run build` passes.

Sub-tasks tracked as sub-issues.
```

### 18. Hidden secrets & explorables — label `enhancement`
**Title:** `Hub: hidden secrets & explorables`

```
Sub-issue of #1602 (Hub World epic).

## Why
Exploration currently has little payoff beyond placed pickups/treasures. Hidden,
discoverable secrets reward curiosity and make the town feel deeper.

## What to build
- A secret/dig-spot interactable type that grants a one-time reward when found, plus
  optional hidden rooms/areas revealed by a trigger, and collectible lore notes.
- Persist discovered secrets.

## Files
- `web/src/data/hub/<town>/config.json` (secret interactables), `HubTownCanvas.tsx`
- `web/src/game/hub/interactables.ts` (or new secrets store); `docs/hubworld.md`

## Acceptance criteria
- At least a few secrets per town can be discovered, grant a reward once, and persist.
- `npm run build` + loader tests pass.

Sub-tasks tracked as sub-issues.
```

### 19. Living shops — label `improvement`
**Title:** `Hub: living shops (shopkeeper NPCs + rotating stock)`

```
Sub-issue of #1602 (Hub World epic).

## Why
The 3 existing shops (`shop-cards`, `shop-augments`, `shop-supplies`) open as bare
screens with no shopkeeper presence in the world. Adding shopkeeper NPCs and visible
rotating stock makes them feel alive (improves what already exists, per user note).

## What to build
- Shopkeeper NPC sprites standing inside each shop interior, with greeting dialogue.
- Visible rotating daily stock surfaced on the shop sign / a preview (reuse
  `shopSchedule.ts` + `shopNpcs.json`).

## Files
- `web/src/data/hub/<town>/config.json` (interior shopkeeper NPCs), `web/src/game/shopSchedule.ts`,
  `web/src/data/shopNpcs.json`, shop screen components; `docs/hubworld.md`

## Acceptance criteria
- Each shop has a shopkeeper NPC + greeting; daily stock is visible and rotates.
- `npm run build` + tests pass.

Sub-tasks tracked as sub-issues.
```

### 20. Mini-game arcade polish — label `improvement`
**Title:** `Hub: mini-game arcade polish (daily challenges + unified prizes)`

```
Sub-issue of #1602 (Hub World epic).

## Why
The hub already has many mini-games (`fishing`, `marble`, `tileflip`, `crystalcatch`,
`spinner`, `marblerace`, `higherOrLower`, `fruitMachine`, `videoPoker`, `towerDefence`,
`citybuilder`). They lack cross-game progression. Daily challenges, leaderboards, and a
unified ticket→prizes flow add replay value (improves what already exists).

## What to build
- A per-mini-game daily high-score challenge (date-seeded) with a small bonus reward.
- Surface best scores / a simple leaderboard in the arcade.
- A unified ticket → `prizes` flow consistent across mini-games.

## Files
- `web/src/game/miniGames.ts`, the mini-game components under `components/hub/` &
  `components/minigames/`, `prizes` screen; reuse achievement hooks already present.

## Acceptance criteria
- At least one mini-game shows a daily challenge + best score; tickets feed the prizes flow.
- `npm run build` + tests pass.

Sub-tasks tracked as sub-issues.
```

---

## ⬜ Link all 20 children as sub-issues of epic #1602

For each child below, call `sub_issue_write` with `issue_number: 1602` and
`sub_issue_id` = the child's database id (see table above for 1–15; capture the
ids returned when creating 16–20).

`#1603, #1604, #1605, #1606, #1607, #1608, #1609, #1610, #1611, #1612, #1613,
#1614, #1615, #1616, #1617`, plus the five new issues for items 16–20.

---

## ⬜ Sub-tasks (create as sub-issues of each parent)

Create each as a normal issue (no label needed, or inherit the parent's), then
nest under its parent via `sub_issue_write` (`issue_number` = parent number,
`sub_issue_id` = sub-task's db id). Bodies can be one line each; reference the
files noted on the parent.

**1 — Hub audio (#1603)**
- Add hub music track to `MUSIC_TRACKS` + a hub branch in `useMusic.ts` (per-town override).
- Wire ambient SFX trigger points (footstep, pickup/treasure, day↔night) via `sound.ts` + `sounds.json`.
- Respect mute/volume; manual + Storybook verification.

**2 — Weather (#1604)**
- Build PixiJS weather overlay layer (rain/snow/fog/wind) in `HubTownCanvas` + `HubWeather` helper.
- Add data-driven `weather` config per town + season hook; document schema in `docs/hubworld.md`.
- Storybook story for each weather type; particle cap + off-screen cull.

**3 — Seasonal events (#1605)**
- `hubCalendar.ts` mapping real date → season/festival + QA override.
- Date-gated festival decor swaps + festival quests in `config.json`/`questDefs.json`.
- "Event active" HUD banner + docs.

**4 — Photo mode (#1606)**
- `PhotoMode` overlay UI (hide HUD, filter/frame controls) + story.
- Canvas → PNG export/share from the PixiJS app.
- Optional free-look pan within town bounds.

**5 — Minimap (#1607)**
- `HubMinimap` rendering town outline + buildings + player position.
- Active-quest target pins from quest state + pickup/NPC positions.
- Off-screen edge arrow to nearest objective + toggle; story.

**6 — Fast-travel (#1608)**
- Waypoint interactables + discovery persistence store (`waypoints.ts`).
- `FastTravelMenu` UI (discovered only) + avatar reposition.
- `docs/hubworld.md` schema + loader test.

**7 — Town directory (#1609)**
- Schedule/clock resolver computing each NPC's current location.
- `TownDirectory` panel UI + "show on minimap" pin (ties #1607).
- Storybook story; optional gate to met NPCs.

**8 — Movement feel (#1610)**
- Click/touch-hold continuous movement (re-path toward pointer).
- Sprint modifier + speed constant + dust cue.
- Verify pathfinding/collision correctness.

**9 — Branching dialogue (#1611)**
- Dialogue-tree schema + parser (`questDefs.json`/`dialogues` block, `loader.ts`).
- `HubDialogue` choice-branch rendering.
- Choice effects (flag / friendship XP / offer quest) + persistence.
- Storybook story for a branching conversation.

**10 — Gift-giving (#1612)**
- Gift preference tables (liked/disliked/neutral) data + docs.
- Gift picker UI from inventory + NPC tap flow.
- Friendship XP award + daily cap persistence; consume item on gift.

**11 — Relationship tracks (#1613)**
- `relationships.ts` state (track + level) + persistence.
- Track advancement via dialogue/gifts; track-gated content in `questDefs.json`.
- Relationship view UI + story.

**12 — NPC daily-life (#1614)**
- Extend schedule schema with activity states (`hubNpcSchedule.ts`).
- Render activity pose/emote in `HubTownCanvas`.
- Author activities for ≥3 NPCs per town + docs.

**13 — Bounty board (#1615)**
- `bounties.ts`: date-seeded rotation + templates + persistence.
- Bounty-board interactable + modal UI + story.
- Progress tracking + turn-in payout (reuse quest/pickup tracking).

**14 — Pet companion (#1616)**
- `pet.ts` store (type/variant/name) + persistence.
- Follower mode in `hubAnimals.ts` + spawn in `HubTownCanvas`.
- Adoption interactable/NPC + rename/swap UI + docs.

**15 — Bestiary/journal (#1617)**
- `journal.ts` discovery store + event hooks (animals/NPCs/areas).
- `TownJournal` UI (tabs + completion %) + story.
- Wire discovery events from taps/area entry.

**16 — Reputation & upgrades (new)**
- `reputation.ts` store + per-building upgrade definitions/costs.
- Upgrade UI (spend crystals) + building state application.
- Unlocked services/decor reflected in the hub; docs.

**17 — Player housing (new)**
- Home layout store (placed furniture) + persistence.
- Decoration/edit mode UI extending `home-shelf` interior + story.
- Furniture catalog data + place/remove/move; docs.

**18 — Hidden secrets (new)**
- Secret/dig-spot interactable type + one-time reward grant + persistence.
- Hidden room/area reveal mechanic.
- Author a few secrets per town + lore notes; docs.

**19 — Living shops (new)**
- Place shopkeeper NPC sprites inside the 3 shop interiors.
- Visible rotating daily stock on signs (reuse `shopSchedule.ts`/`shopNpcs.json`).
- Shopkeeper greeting dialogue + story.

**20 — Arcade polish (new)**
- Per-mini-game daily high-score challenge (date-seeded) + bonus reward.
- Leaderboard / best-score surfacing in the arcade.
- Unified ticket → `prizes` flow across mini-games.

---

## Execution order for the new session
1. Create the 5 parent issues (items 16–20); capture their numbers + db ids.
2. Link all 20 children as sub-issues of epic #1602.
3. Create the ~61 sub-tasks above and nest each under its parent.
4. Tick the epic #1602 checklist (replace bullet numbers with `#NNNN`).
5. Delete this handoff file.
