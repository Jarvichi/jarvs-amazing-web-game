# Screen Audit — what still needs the satchel/settings treatment

An inventory of every screen the player can reach, measured against the bar that
the satchel sheet and the settings screen now set, and a priority order for
closing the gap.

Read alongside [`ui-design.md`](ui-design.md), which is the design-system
reference this audit measures against. This document is the *gap list*; that one
is the *spec*.

Measured against `web/src/` at commit `750fdd1` (11 Sep 2026).

---

## 1. Why this audit exists, given #2165 says the screen passes are done

The UI overhaul epic (#2165) ran a Phase 2 "screen pass" over seven areas
(#2175–#2181) and closed all seven. Those passes were **visual**: they restyled
existing structures onto the new tokens, surfaces and buttons. They did not
change how a screen is *built*.

The satchel (#2200-series) and settings (#2165) redesigns that followed set a
**second, higher bar** — a structural one. That bar is what almost nothing else
in the game meets, and it is what "a similar face lift" means in practice.

So: a screen being ticked off in #2165 is not evidence that it meets the bar. In
several cases below it is a screen that got repainted and left otherwise intact.

## 2. The bar, stated explicitly

Two reference patterns now exist. Both say the same thing in different shapes.

### 2.1 The overlay pattern — `SettingsScreen.tsx`

```
OverlayScreen (PageHeader owns title + back)
  └── TabNav              one tab strip, real tablist, roving tabIndex
      └── Panel           one bordered surface
          └── SettingsRow / SettingsToggle / SettingsSlider
              └── AudioTab · DisplayTab · AccountTab · GameTab · AboutTab · AdminTab
                  (10 extracted files, one .stories.tsx each)
```

109 lines in the shell. Fourteen stacked sections became six tabs. The shell
routes; the tabs own their own state; nothing draws its own chrome.

### 2.2 The sheet pattern — `SatchelMenu.tsx` / `SatchelSheet.tsx`

```
SatchelSheet (ModalBackdrop; owns title, close, search, nav — the ONLY place each is drawn)
  └── TabNav placement="bar"     thumb bar on phones, left rail from tablet up
      └── ListRow · ItemTile · GroupHeading · CollapsibleGroup · ActionCard
          · EntityChip · FilterChips · ItemDetailSheet · EmptyState
              └── QuestsContent · HubInventoryContent · TradeJournalContent
                  · TownDirectoryContent · TownJournalContent · HubTownUpgradesContent
                  (11 extracted files, one .stories.tsx each)
```

The header comment in `SatchelSheet.tsx` names the disease it cured exactly:

> The old tabbed modal drew its title three times (backdrop label, shell tab
> label, and again inside every content component, each of which brought its own
> ✕ because each had been a standalone modal first).

### 2.3 The five properties, as a checklist

| # | Property | Test |
|---|---|---|
| 1 | **Shell owns chrome** | Title, back/close, search and nav are drawn once, by the shell. Content renders only content. |
| 2 | **Shared vocabulary** | Rows, tiles, groups, chips, toggles come from primitives — not from markup written for this screen. |
| 3 | **Tokens, not literals** | No inline `style={{}}` carrying colour or spacing; no hex that a token already names. |
| 4 | **Extracted + storied** | Screen is a router; its pieces are props-only files with a `.stories.tsx` each. |
| 5 | **One tab strip** | `TabNav`, not another `filter-btn` row. |

---

## 3. Method

Static measurement over `web/src/components/**/*.tsx` (production files only —
`.stories.tsx` and `.test.tsx` excluded) and `web/src/styles/*.css`. Counted per
screen: shell primitive in use, number of distinct shared primitives used,
inline `style={{}}` objects, hardcoded hex literals, raw `<button>` elements,
emoji glyphs, and extracted sub-component files.

Traffic (H/M/L) is judgement, anchored on reachability: the title screen's
`MANAGE` nav and play row (`ManageNav.tsx`, `SecondaryPlayRow.tsx`) define the
top-level destinations; campaign run screens are rated by how many times an act
shows them.

The scripts were throwaway; the numbers below are the output. Re-derive rather
than trusting these once the tree has moved on.

---

## 4. Cross-cutting findings

### 4.1 The two redesigns produced reusable vocabulary that was never promoted

This is the single most important finding, and it gates most of §6.

`ListRow`, `ItemTile`, `GroupHeading`, `CollapsibleGroup`, `ActionCard`,
`EntityChip`, `FilterChips`, `ItemDetailSheet` live in
`components/hub/satchel/`. `SettingsRow`, `SettingsToggle`, `SettingsSlider`
live in `components/screens/settings/`. Their CSS is namespaced to match —
`.satchel-row__title`, `.settings-toggle-track`.

Usage outside their home folder:

| Primitive | Used outside its own folder by |
|---|---|
| `ListRow` | `QuestsModal` only |
| `ItemTile` | `HubInventoryModal`, `ChefCookingModal` |
| `GroupHeading` | `QuestsModal`, `HubInventoryModal` |
| `FilterChips` | 3 hub files |
| `CollapsibleGroup`, `ActionCard`, `EntityChip` | nothing |
| `SettingsRow`, `SettingsToggle`, `SettingsSlider` | nothing |

Every consumer is itself satchel-embedded content. Nothing in campaign, battle,
collection, shop or the minigames can reuse any of it without importing a
component whose class names say "satchel".

The cost of that is measurable. Across `web/src/styles/*.css` there are **483
distinct class selectors** ending in a row/item/tile/card/entry/chip/pill/badge/
toggle suffix, including **41 different `-row` classes**: `.ach-row`,
`.bf-deck-row`, `.bj-row`, `.chr-alignment-row`, `.city-cost-row`,
`.deck-power-row`, `.farm-raid-row`, `.prize-row`, `.race-result-row`,
`.reward-summary-row`, `.settings-row`, `.satchel-row`, `.shelf-row`,
`.stat-row`, `.td-selected-panel-row`, `.title-periodic-row`… — 41 answers to
"a label on the left, a value on the right".

**Nothing below gets materially cheaper until this is fixed, and every screen
redesigned before it is fixed adds a 42nd row class.**

### 4.2 The icon system (#2172) never propagated past the title screen

`ICON_NAMES` has 24 entries. Production `.tsx` files contain **1,099 emoji
glyphs across 174 files**. `<Icon name="crystal">` — the game's primary currency
— has exactly **one** call site, `TitleIdentityFooter.tsx`; `💎` appears in 25
other files including Shop, Collection, Merchant, Mini-games menu, Home shelf and
the Hall of Achievements.

Worst offenders: `FruitMachine.tsx` (89), `CityBuilder.tsx` (62),
`HubWorld.tsx` (52), `TowerDefence.tsx` (27), `MiniGamesMenu.tsx` (23),
`ShopScreen.tsx` (19).

This is why screens that are otherwise fine still look unlike each other: the
same concept is drawn with a different glyph on every screen, and emoji render
per-platform, which is the thing #2165 objected to in the first place.

### 4.3 Foundation landed; drift did not stop

Comparing #2165's opening audit to today:

| Metric | #2165 (Aug 2026) | Now | |
|---|---|---|---|
| Hardcoded hex in `.tsx` | 1,529 | **1,347** | ↓ 12% |
| Inline `style={{}}` in `.tsx` | 1,414 | **1,246** | ↓ 12% |
| Raw `<button>` | 701 | **436** | ↓ 38% |
| `<Button>` call sites | 8 | **282** | ↑ |
| `aria-label` | 19 | **79** | ↑ (#2182 still open) |
| Stylesheet | 15,758 lines, 1 file | 19,703 lines, 26 files | split done (#2169) |

The primitives took hold. The *literals did not go away* — they were diluted by
growth. New screens still arrive carrying their own hex.

### 4.4 Token adherence is bimodal, and splits on age

Hex literals vs `var(--…)` references per stylesheet:

| Stylesheet | hex | var() | ratio | verdict |
|---|---:|---:|---:|---|
| `minigames-2.css` | 214 | 55 | **3.9** | worst in the tree |
| `minigames-1.css` | 141 | 102 | 1.38 | |
| `collection-meta.css` | 32 | 29 | 1.10 | Codex + Character live here |
| `minigames-3.css` | 101 | 102 | 0.99 | |
| `minigames-4.css` | 145 | 196 | 0.74 | |
| `campaign.css` | 86 | 129 | 0.67 | |
| `rare-events.css` | 36 | 57 | 0.63 | |
| `collection.css` | 67 | 209 | 0.32 | |
| `cards.css` | 44 | 115 | 0.38 | |
| **`satchel.css`** | **13** | **101** | **0.13** | the bar |
| `minigames-5/6/7.css` | 9/14/12 | 56/38/64 | 0.16–0.37 | the bar |
| `tabs.css`, `panels.css` | 2/5 | 31/92 | 0.05 | the bar |

The split is chronological, not architectural: `minigames-5/6/7.css` (Wellspring,
Cask Sounding, Stowage — the three most recent games) sit with the satchel;
`minigames-1..4.css` (everything older) hold **601 hex literals against 455
`var()` references** between them.

### 4.5 `TabNav` replaced six tab strips; three more survive

`TabNav.tsx`'s header lists the six it absorbed. Still hand-rolled:

- `CodexScreen.tsx` — six tabs built from `filter-btn` + a second `filter-btn--sm`
  filter row. Structurally the same screen as Settings, solved differently.
- `MiniGamesMenu.tsx` — two strips, `.lb-game-tabs` and `.lb-mode-tabs`.

### 4.6 Two more small consistency gaps

- **Back controls.** `PageHeader` gives an icon-only back button in a
  three-column grid. `QuickBattleScreen` and `CardDraftScreen` instead put a
  full-width `← BACK` *danger* button at the bottom of the screen — red, which
  the token system reserves for destructive actions.
- **Cross-domain class borrowing.** `CharacterScreen.tsx` renders
  `<div className="event-screen">` / `.event-title` — classes that belong to the
  campaign event node. A change to event-node styling silently restyles the
  character creator.

---

## 5. The inventory

`T` = traffic. `SHELL` = shell primitive. `VOC` = count of distinct shared
primitives used. `INL` = inline `style={{}}`. `HEX` = hardcoded hex. `BTN` = raw
`<button>`. `EMO` = emoji glyphs. `SUB` = extracted sub-component files.

### Top-level destinations

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Settings **(reference)** | H | 109 | OverlayScreen | 2 | 0 | 2 | 0 | 0 | **10** |
| Satchel **(reference)** | H | 205 | SatchelSheet | — | 0 | 0 | 0 | 1 | **11** |
| Title screen | H | 303 | root | 1 | 1 | 0 | 0 | 3 | 7 |
| Player (shell) | H | 58 | OverlayScreen | 1 | 0 | 0 | 1 | 1 | 0 |
| Player › Stats | H | 78 | OverlayScreen | 0 | **7** | 0 | 0 | 3 | 0 |
| Player › Character | M | 214 | OverlayScreen | 2 | **7** | 4 | 2 | 3 | 0 |
| Player › Achievements | H | 237 | OverlayScreen | 3 | 0 | 0 | 0 | 16 | 0 |
| Player › Inventory | M | 212 | OverlayScreen | 3 | 0 | 0 | 2 | 1 | 0 |
| Player › Quests | M | 77 | OverlayScreen | 0 | 0 | 0 | 0 | 5 | 0 |
| Deck builder | H | **984** | OverlayScreen | 3 | 3 | 0 | 8 | 18 | 0 |
| Collection | H | **630** | OverlayScreen | 2 | 12 | 4 | 1 | 14 | 0 |
| Collection › Augments | M | **615** | OverlayScreen | 3 | 15 | 12 | 5 | 3 | 0 |
| Shop | H | 487 | OverlayScreen | 1 | 0 | 0 | 2 | **19** | 0 |
| Codex | M | 319 | OverlayScreen | 1 | 5 | 4 | 3 | 2 | 0 |
| Chronicle | M | 215 | OverlayScreen | 0 | 2 | 0 | 2 | 3 | 0 |
| What's New | M | 172 | OverlayScreen | 2 | 0 | 0 | 0 | 0 | 4 |

### Play entry points

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Quick Battle setup | H | 185 | **—** | 1 | 0 | 0 | 0 | 1 | 0 |
| Mini-games menu | M | 442 | OverlayScreen | 2 | 0 | 0 | 3 | **23** | 0 |
| Daily Challenge | M | 111 | PageHeader | 2 | 0 | 0 | 0 | 4 | 0 |
| Weekly Challenge | M | 117 | PageHeader | 2 | 0 | 0 | 0 | 7 | 0 |
| Leaderboards | M | 116 | PageHeader | 1 | 1 | 0 | 0 | 2 | 0 |
| Training | L | 140 | OverlayScreen | 2 | 0 | 0 | 3 | 0 | 0 |

### Battle and run end

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Battlefield | H | 689 | — | 1 | 6 | 5 | 3 | 16 | 8 |
| Game over | H | 251 | **—** | 2 | 0 | 1 | 0 | 8 | 0 |
| Post-battle reward | H | 182 | **—** | 1 | 1 | 2 | 1 | 1 | 0 |
| Battle summary | H | 60 | **—** | 2 | 0 | 0 | 0 | 0 | 0 |
| Victory panel | H | 42 | **—** | 2 | 0 | 0 | 0 | 0 | 0 |
| Card detail | H | **608** | ModalBackdrop | 2 | 6 | 5 | **8** | 11 | 0 |
| Pack opening | H | 316 | ModalBackdrop | 1 | 5 | 5 | 0 | 3 | 0 |
| Card augment | M | 252 | ModalBackdrop | 1 | 6 | 5 | 0 | 1 | 0 |

Battle summary and Victory panel show `—` because they take no *screen* shell,
but both compose `ui/RunEndCard` — they are fine. Game over and Post-battle
reward are the two that do not. See P2.3.

### Campaign run loop — every one of these appears in every act

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Campaign map | H | 154 | OverlayScreen | 0 | 0 | 0 | 0 | 6 | 0 |
| Merchant node | H | 172 | OverlayScreen | 1 | 0 | 0 | 0 | 7 | 0 |
| Camp / rest node | H | 106 | **—** | 0 | 0 | 0 | 4 | 3 | 0 |
| Event node | H | 102 | **—** | 1 | 2 | 3 | 1 | 0 | 0 |
| Relic select | H | 74 | **—** | 1 | 2 | 0 | 2 | 1 | 0 |
| Mystery node | M | 52 | **—** | 1 | 0 | 0 | 0 | 2 | 0 |
| Relic spin | M | 73 | **—** | 1 | 0 | 0 | 0 | 3 | 0 |
| Stat upgrade | M | 89 | **—** | 1 | 1 | 0 | 1 | 3 | 0 |
| Replay briefing | M | 234 | **—** | 1 | 0 | 2 | 1 | 5 | 0 |
| Cutscene | M | 64 | **—** | 0 | 0 | 0 | 0 | 0 | 0 |

### Hub world

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Hub world | H | **2720** | StageChrome | 1 | 4 | 5 | 0 | **52** | 0 |
| Home shelf | M | 618 | OverlayScreen | **4** | 0 | 0 | 1 | 13 | 4 |
| Hall of Achievements | M | 228 | OverlayScreen | 2 | 0 | 11 | 1 | 3 | 0 |
| Hub world map | M | 162 | OverlayScreen | 1 | 2 | 0 | 0 | 8 | 0 |
| Casino | L | 288 | OverlayScreen | 1 | 0 | 2 | 0 | 4 | 0 |
| Theatre | L | 240 | MinigameShell | 1 | 3 | 0 | 0 | 10 | 0 |
| Fish appraisal | L | 103 | OverlayScreen | 2 | 0 | 0 | 1 | 5 | 0 |

### Mini-games

All 14 sit on `MinigameShell` or `OverlayScreen` (#2181 did that). The split is
everything below the shell.

| Screen | T | LOC | Shell | VOC | INL | HEX | BTN | EMO | SUB |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| City Builder | M | **1984** | OverlayScreen | 1 | 4 | 4 | 1 | **62** | 25 |
| Fruit Machine | L | **1112** | MinigameShell | 1 | 1 | 0 | 6 | **77** | 0 |
| Farming Sim | M | 786 | OverlayScreen | 1 | 1 | 1 | 0 | 16 | 0 |
| Tower Defence | M | 606 | **—** | 1 | 2 | 0 | **7** | 25 | 8 |
| Fishing | M | 448 | MinigameShell | 1 | 1 | 0 | 1 | 8 | 4 |
| Harbour Regatta | L | 381 | MinigameShell | 2 | 5 | 6 | 0 | 11 | 0 |
| Marble Race | L | 352 | MinigameShell | 2 | 3 | 6 | 1 | 11 | 0 |
| Video Poker | L | 342 | MinigameShell | 2 | 0 | 0 | 1 | 15 | 0 |
| Marble Run | L | 314 | MinigameShell | 2 | 0 | 0 | 1 | 4 | 0 |
| Crystal Catch | L | 201 | MinigameShell | 1 | 3 | 0 | 1 | 8 | 0 |
| Higher or Lower | L | 175 | MinigameShell | 1 | 0 | 0 | 0 | 19 | 0 |
| Tile Flip | L | 147 | MinigameShell | 0 | 0 | 0 | 1 | 13 | 0 |
| Lucky Spinner | L | 138 | MinigameShell | 1 | 1 | **13** | 0 | 1 | 0 |
| — *Cask Sounding* | L | 238 | MinigameShell | 1 | 0 | 0 | 2 | 9 | **3** |
| — *Stowage* | L | 227 | MinigameShell | 1 | 0 | 0 | 0 | 6 | **3** |
| — *Wellspring* | L | 205 | MinigameShell | 1 | 0 | 0 | 0 | 6 | **3** |

The last three already meet the bar and are the template for the other eleven.

---

## 6. Priority order

Ranked by **traffic × distance from the bar ÷ cost**. Foundation first, because
it changes the cost of everything under it.

### P0 — Foundation (do before any screen below)

**P0.1 — Promote the row/tile/group vocabulary into `ui/`.**
Move `ListRow`, `ItemTile`, `GroupHeading`, `CollapsibleGroup`, `FilterChips`,
`ItemDetailSheet`, `ActionCard`, `EntityChip` out of `hub/satchel/` and
`SettingsRow` / `SettingsToggle` / `SettingsSlider` out of `screens/settings/`,
renaming their CSS off the `satchel-`/`settings-` prefixes onto neutral names
with `--`-custom-property retinting (the pattern `CloseButton` and `EmptyState`
already use). Keep the existing call sites working via re-export.
*Why first:* §4.1. Every item below either reuses this or invents a 42nd row class.
*Cost:* medium. *Unblocks:* everything.

**P0.2 — Finish #2172 for the shared concepts.**
Not all 1,099 glyphs — the ~10 that recur across screens: crystals, HP, mana,
lock, card, pack, trophy, quest, time. Add the missing `<symbol>`s, then sweep
the currency glyph first (26 files).
*Why:* §4.2. It is the most visible cross-screen inconsistency and it is cheap
per screen once the symbols exist.
*Cost:* low–medium. *Unblocks:* the visual half of every item below.

### P1 — High traffic, furthest from the bar

**P1.1 — The Player screen's five tabs.**
`PlayerScreen` is already the settings shape (OverlayScreen + TabNav), but its
tabs were never brought along. `PlayerStatsScreen` builds its entire body from
**seven inline `style={{}}` objects** that reimplement, badly, the exact
icon + label + value + note row that `ListRow` already renders.
`CharacterScreen` carries seven more with `#aaffaa` / `#ff6666` hardcoded, and
borrows `.event-screen` / `.event-title` from the campaign domain (§4.6).
`QuestsScreen` uses no primitive at all and has no story file. The shell also
ends with a raw `<button className="title-auth-btn">🔓 SIGN OUT</button>`.
*Why first:* highest traffic behind the most-used nav item, and P0.1 makes it
nearly mechanical — this is the screen that proves the promoted vocabulary works.
*Cost:* low, after P0.1.

**P1.2 — Shop.**
487 lines, one shared primitive (`Button`), 19 emoji, 2 raw buttons, a
hand-rolled category grid and `💎` in the header slot where the title screen
puts `<Icon name="crystal">`. It is the economy screen, and gold-for-economy is
the art direction's most specific rule (#2165) — this is where it should read
most clearly and currently doesn't.
*Cost:* medium.

**P1.3 — The campaign run screens, as one job.**
Camp, Event, Mystery, Relic select, Relic spin, Stat upgrade, Replay briefing,
Cutscene — **eight screens, none of which uses a shell.** Each invents its own
header: `— CAMP —`, `// MYSTERY NODE`, `.event-title`, `.mystery-header`. Camp
has four raw `<button>`s including `.camp-continue`; Event hardcodes
`#33ff33`/`#ffcc00`/`#ff4444` in a `hpColor()` function that duplicates tokens.
Every act shows all of them, back to back, with the campaign map (which *does*
use `OverlayScreen`) in between — so the inconsistency is visible within seconds.
*Why together:* they share a frame and a single node-screen shell fixes all eight.
*Cost:* medium. Highest inconsistency-per-minute-played in the game.

**P1.4 — Codex.**
Six tabs built from `filter-btn` plus a second `filter-btn--sm` filter row —
structurally identical to Settings, solved differently (§4.5). Five inline
styles with `#ffd54f`; no `.stories.tsx`; sits on `collection-meta.css`, one of
the worst hex:var ratios in the tree (§4.4).
*Cost:* low. Near-mechanical once `TabNav` goes in.

### P2 — High traffic, structurally large

**P2.1 — Deck builder and Collection.**
984 and 630 lines, **zero extracted sub-components between them**, 15 inline
styles, 9 raw buttons. #2178 repainted them; the structural split never
happened. These are the two screens the AGENTS.md extraction rule was written
for, and they are the largest remaining violation of it.
*Cost:* high. Split first (extract + story each piece), restyle second.

**P2.2 — Card detail modal.**
608 lines, 8 raw `<button>`s, 6 inline styles, 5 hex. The most-opened modal in
the game — every card tap in collection, deck builder, shop and battle.
*Cost:* medium–high.

**P2.3 — The two run-end screens that missed `RunEndCard`.**
Smaller than it first looks, and worth stating plainly: `ui/RunEndCard.tsx` is
*already* the shared answer to "the run ended, here is what you got", adopted by
six screens — Victory panel, Battle summary, Act complete, To be continued,
Campaign victory, Campaign failed. The outliers are **Game over** (251 lines, 8
emoji) and **Post-battle reward** (182 lines, its own `.reward-screen` /
`.reward-header` frame), which are the two the player sees most often.
*Cost:* low. Bring both onto `RunEndCard`; do not redesign the six that already are.

### P3 — Lower traffic, or large but contained

**P3.1 — The eleven legacy mini-games** (`minigames-1..4.css`): 601 hex vs 455
`var()`; Fruit Machine alone is 1,112 lines with 77 emoji; Tower Defence is the
only mini-game with no shell and has 7 raw buttons. Wellspring / Cask Sounding /
Stowage are the template. Best done a few at a time, worst ratio first.

**P3.2 — Mini-games menu**: two bespoke tab strips (§4.5), 23 emoji, 3 raw buttons.

**P3.3 — Hub secondary screens**: Hall of Achievements (11 hex), Hub world map,
Casino, Theatre (no story file). Note #2165's own ruling — gameplay work on the
hub (#2147) takes precedence over its visual pass.

**P3.4 — Collection › Augments**: 615 lines, 15 inline styles, 12 hex, 5 raw
buttons, plus a hand-rolled `← Back to All` `filter-btn`. High cost, medium
traffic — worth folding into P2.1 rather than doing standalone.

### Not prioritised, deliberately

- **Admin, editor and dev screens** (`admin/`, `mapEditor/`, `battlefieldEditor/`,
  `DevMenu`) — `CampaignAdminScreen` has 55 inline styles and 17 raw buttons, the
  worst numbers in the tree, but #2088 gates these out of store builds entirely.
  Not player-facing; not worth a redesign budget.
- **Battlefield HUD** — #2176 landed recently, it has 8 extracted sub-components,
  and it is canvas-heavy where the DOM rules mostly don't apply.
- **Title screen** — #2175 brought it to the bar: 7 extracted sub-components,
  `Icon` throughout, `title.css` at 5 hex / 65 `var()`.
- **Hub world canvas** (`HubWorld.tsx`, 2,720 lines / 52 emoji) — genuinely the
  worst single file, but it is a Pixi stage plus gameplay logic, not a screen
  layout. Its *chrome* is in scope via P3.3; the file itself wants a gameplay-led
  split, not a facelift.

---

## 7. Suggested issue shape

If this becomes work, it fits #2165 as a Phase 4 — "structural passes" — rather
than reopening the closed Phase 2 issues, which were scoped to visual work and
did what they said:

```
#2165 UI overhaul
└── Phase 4 — Structural screen passes
    ├── P0.1  Promote the row/tile/group vocabulary into ui/
    ├── P0.2  Finish the icon system for shared concepts (child of #2172)
    ├── P1.1  Player screen — bring the five tabs onto the settings pattern
    ├── P1.2  Shop
    ├── P1.3  Campaign node screens — one shell for all eight
    ├── P1.4  Codex — TabNav and the settings pattern
    ├── P2.1  Deck builder + Collection — extract, then restyle
    ├── P2.2  Card detail modal
    ├── P2.3  Game over + Post-battle reward onto RunEndCard
    └── P3.x  Legacy mini-games, mini-games menu, hub secondaries
```

P0.1 and P0.2 are the only ordering constraint. Everything in P1–P3 is
independent of everything else in P1–P3.

## 8. Keeping the audit honest

Two of these findings could be enforced rather than re-audited, the way
`pressFeedback.test.ts` enforces `:active` and `theme.test.ts` enforces
token/TS agreement:

- A test that fails when a new `-row`/`-tile`/`-chip` class appears in
  `styles/*.css` without an entry in an allow-list — the same shape as
  `ALLOWED_HOVER_ONLY`.
- A test that fails on a new emoji glyph in a `.tsx` under `components/`, once
  #2172's symbol set covers the shared concepts.

Neither is worth writing before P0 lands; both stop the list regrowing after.
