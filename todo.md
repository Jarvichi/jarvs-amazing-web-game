# Jarv's Amazing Web Game — Todo List

Issues sourced from GitHub. Last synced: 2026-04-04 (session 34 — issue check).

---

When working an issue from this file, go and check the GitHub issue for additional detail and requirements before planning the solution, create a todo list based on the plan and execute it. If running in the cli you can usually use the "gh" cli commands to help, however if they are not available use a fallback method.

---

## 🔴 Bugs — New (from GitHub, session 33 sync)

- [x] **#575** Boss fights not triggering — acts 5-13 missing bossCard (no phase-2 fight); act3 bossCard conflicted with split trait (removed); bossCards added for acts 5-7, 9-13; acts 3&8 use split trait as their mechanic
- [x] **#585** Daily login shows no content — consumable type had no render branch; crystals weren't being credited; added Rollbar error + 10-crystal fallback for unknown types
- [x] **#584** "Jarv" hardcoded — DailyLoginModal, WrongNumberEvent, CampaignVictoryScreen, EventScreen now use loadPlayerName(); act JSON already uses applyPlayerName()
- [x] **#580** Time in game/battle resets on new device — added flushPlaytimeToStorage() helper; called before every uploadSave() so in-memory session deltas are captured

## 🔵 Enhancements — New (from GitHub, session 34 sync)

- [ ] **#570** Marble run: shuffle ticket quantities between games so player can't aim at the same position each time
- [ ] **#561** Marble race minigame: player picks 1 of 4 coloured balls; all dropped into a track; roll down across obstacles; prizes for 1st / 2nd / 3rd / runner-up

## 📄 Docs — New (from GitHub, session 34 sync)

- [ ] **#517** Add `Firebase.md` setup guide: manual Firebase config steps, authorize domain for Google sign-in, enable Google provider, deploy Firestore security rules, Firebase CLI setup for local dev

## ⚪ Noise / Low Priority (from GitHub, session 33 sync)

- [ ] **#583** Intentional Rollbar test error — can close (was a deliberate debug test)
- [ ] **#582** InvalidStateError: ServiceWorker update failed — browser/OS noise; same class as #581
- [ ] **#581** TypeError: ServiceWorker update failed (Not found) — SW noise; consider suppressing in unhandledrejection handler
- [ ] **#577** SecurityError: sw.js load failed (old GitHub Pages domain) — stale domain issue; users on new domain unaffected
- [ ] **#576** TypeError: Internal error — too vague; monitor in Rollbar
- [ ] **#578** Script error (unknown) — same class as #483; already noted

---

## ✅ Closed (session 25)

- [x] **#178** Per-act themed card sets — Act 4 rewardTags fixed ('crystal'→'spire','arcane'); 5 new Crystal Spire cards added (Prism Warden, Shard Familiar, Arcane Conduit, Resonance Spire, Crystalline Shell); all sprites created. Acts 1–4 now have 25+ themed cards each.

---

## 🔴 Bugs — New (from GitHub, session 32 sync)

- [ ] **#573** Black screen after relic select + lore text — Rollbar logging added to relic→cutscene→nodemap flow; root cause still unknown (needs live Rollbar data)
- [x] **#572** Relic selection screen — leaving game resets to ACT 1; fixed with pendingRelicSelect flag in RunState/loadRun
- [x] **#571** Commander cooldown reset — cooldowns now initialised from cooldownRemaining() on mount
- [x] **#564** Cannot read property k.unitTemplate — already fixed by prior commits (guard added); close issue manually

---

## 🔴 Bugs — New (from GitHub, session 31 sync)

- [x] **#552** Mini games screen doesn't scroll — `.minigame-hub`/`.minigame-screen` changed to `height:100%; overflow-y:auto`
- [x] **#551** Minigame tickets not in inventory — root cause was #547; with Crystal Catch fixed, tickets persist correctly via itemStore
- [x] **#550** Minigame ticket prizes balance — crystal prizes reduced (50/150 crystals); card prizes now consistently better value
- [x] **#549** Marble Run patterns — 5 named patterns (Funnel, Zigzag, Chaos, Wall Left, Wall Right); random pattern per drop; obstacle pegs shown as ◄ ► ✦
- [x] **#548** Lucky Spinner blank screen — wheel `<div>` → `<svg viewBox="0 0 240 240">` with SVGSVGElement ref
- [x] **#547** Crystal Drop items never fall — stale `tick` closure fixed with mutable `tickRef`; removed conflicting CSS transition
- [x] **#546** High scores not working — root cause was #547/#548; once games produce scores, `saveLocalHighScore` + "Best:" label work correctly

---

## 🔴 Bugs — New (from GitHub, session 30 sync)

- [x] **#542** Boss traits not firing — flipped all `implemented: false` → `true` in bossAIs.json; engine already had full mechanics
- [x] **#541** Victory celebration black screen — new `celebration` phase; 3s YOU WIN! overlay + dancing units before gameOver
- [x] **#539** Unit priorities / target switching — added `targetId`/`lastAttackerId` sticky targeting; 5-tier priority order in findAttackTarget()

## 🟣 Large Features — New (from GitHub, session 30 sync)

- [ ] **#540** Mini games — marble run + 3 arcade mini games, ticket economy, prizes, achievements, high scores (requires own session)

## 🔴 Bugs — New (from GitHub, session 29 sync)

- [x] **#441** Event screen reached without activeEvent or run — gainCard path sets activeEvent=null but leaves screen='event', triggering the guard
- [ ] **#483** Script error (unknown) — Rollbar item, likely a third-party/browser script error; investigate if reproducible
- [x] **#509** deployCard: card has no unit template — 13 structure cards in cards.json use non-standard schema (top-level structureEffect, spawnUnitRef) that resolveCardDef doesn't process, leaving card.unit=undefined

## 🔴 Bugs — New (from GitHub, session 28 sync)

- [x] **#496** Sudden death does not trigger in daily challenge mode — already fixed
- [x] **#497** Daily challenge: Give Up should count as a failed attempt — saveDailyChallengeResult(false) called in handleGiveUp before clearing flag
- [x] **#495** Bloom Spire / Lava Spire overpowered — added targetUnitType field; Bloom Spire targets flying only, Lava Spire targets ground only

## 🔵 Enhancements — New (from GitHub, session 28 sync)

- [x] **#498** Blood pool avoidance — pre-compute dense clusters (3+ pools/50px); lateral repulsion for non-flying units
- [x] **#499** Endless mode leaderboard: split into "Today's best players" and "All time best"; date field added to publishEndlessResult

## 🔴 Bugs — New (from GitHub, session 27 sync)

- [x] **#487** "Daily Challenge Complete" shows on non-daily-challenge post-battle screens — cleared isDailyChallengeRef in handlePlay/handleEndless/handleGiveUp/handleMainMenu
- [x] **#476** Daily challenge win screen shows wrong attempt count — snapshot dcGameOverState before saving; removed +1 in GameOver display
- [x] **#461** Consumables/items unified store — new itemStore.ts (jarv_item_store) unifies consumables, relics, and useless items under one key with type tags; legacy keys migrated on first load; ShopScreen now removes sold items from inventory
- [x] **#459** Resting resets over-max HP back to max — rest heal now uses Math.max(playerHp, …) to preserve over-max HP
- [x] **#488** Campaign shop/merchant layout differs from main shop layout — MerchantScreen now uses OverlayScreen + shop-section/shop-daily-cards/shop-consumables structure
- [x] **#468** Narrator rare event text displays too briefly — increased DISPLAY_MS from 7s to 11s
- [x] **#465** Campaign Peek Node lists replay modifiers separately instead of summing them — collapseModifiers() groups by type and sums values

## 🔵 Enhancements — New (from GitHub, session 27 sync)

- [x] **#490** Replace `useState` with `useReducer` for battle/game state — battleReducer.ts with 7 battle-scoped states; 21 unit tests; App.tsx refactored to dispatch actions (START/END/TICK/PLAY_CARD etc.)
- [x] **#463** Battlefield UI cleanup — hide Hand/Deck count; modifiers only in pause menu; deck viewer in pause menu (scrollable, HAND badge, dimmed played cards)
- [x] **#464** Add achievements for recently added acts — acts 5-10 each get x1/x10/x100 completion achievements
- [x] **#469** Endless mode achievements — wave 42/69/99/100/1000 milestones added
- [x] **#470** More player avatars — 13 boss avatars (one per act boss), unlocked via campaign:actN:boss achievements; BOSS AVATARS section in CharacterScreen
- [x] **#486** New achievements: win with all-legendary deck; win playing only one card

## 🟣 Large Features — New (from GitHub, session 27 sync)

- [x] **#481** Training mode — practice vs single unit with chosen cards
- [x] **#473** Boss Cards — legendary cards earned by beating bosses 10/20/30/40 times; 13 bosses; cost 6 mana
- [x] **#477** Commander — all sub-issues done (#478 XP, #479 level-up anim, #480 tap/gyro/idle)
- [ ] **#474** Next 25-act campaign chapter "The Forbidden Word"
- [x] **#466** Boss spawn kill scaling — 50% base + 10% per run (runCount-1), capped at 100%
- [x] **#467** Secrets and Rare Things — all 10 secrets implemented
- [ ] **#489** Game Engine (tracking issue)
- [ ] **#462** Battles (tracking issue)
- [ ] **#460** Shop and Items (tracking issue)
- [ ] **#458** Campaign Issues (tracking issue)

## 🔴 Bugs — New (from GitHub, session 26 sync)

- [x] **#471** TypeError: undefined is not an object (evaluating 't.maxHp') — validate loadBattleState; fix unsafe optional chaining in dep arrays

## 🔴 Critical — New (from GitHub, session 23 sync)

- [x] **#402** Security: remove hardcoded Firebase API key from source — fixed (pending config merge)

## 🔴 Bugs — New (from GitHub, session 24 sync)

- [x] **#432** Resting cards show zero usage — store play counts before clearing run; pass to CardRestSelect via dedicated state
- [x] **#430** Unplayable cards in hand — endless mode reshuffle now uses endlessPlayerDeckTemplate and assigns fresh IDs to prevent duplicate React keys

## 🔴 Bugs — New (from GitHub, session 23 sync)

- [x] **#418** TypeError: Load failed — fetchDailyLeaderboard wrapped in try/catch
- [x] **#417** useAuth: auth state changed — removed noisy rollbar.info that fired every page load
- [x] **#416** UnknownError: Connection to Indexed Database server lost — suppressed via global unhandledrejection handler in main.tsx
- [x] **#413** Freezer — fixed
- [x] **#412** Font size / light mode settings — applyLightMode now removes inline --game-text-color override so light mode CSS rule applies correctly

## 🔵 Enhancements — New (from GitHub, session 23 sync)

- [ ] **#422** Daily challenge replay weighting — adjust replay selection logic for daily challenges

## ✅ Closed since last sync (session 23)

- [x] **#395** Zooming during boss battle — confirmed closed on GitHub
- [x] **#392** Structure upgrade not scaling — confirmed closed on GitHub
- [x] **#397** Different unit sizes — confirmed closed on GitHub

---

## 🟠 Active Work

### #68 — Dark/Light Mode ✅

- [x] Add CSS variables + `html.light-mode` overrides in `styles.css`
- [x] Add `loadLightMode` / `saveLightMode` / `applyLightMode` helpers + toggle in `SettingsScreen.tsx`
- [x] Call `applyLightMode()` on startup in `App.tsx`

### #305 — Deck Saving and Sharing ✅

- [x] Add `SavedDeck` type + `loadSavedDecks` / `saveNamedDeck` / `deleteSavedDeck` to `collection.ts`
- [x] Add `encodeDeck` / `decodeDeck` share-code helpers to `collection.ts`
- [x] Add SAVED DECKS + SHARE UI panels to `DeckBuilder.tsx`
- [x] Add CSS for saved-deck and share panels

---

## 🔵 Enhancements — New (from GitHub, session 17 sync)

- [x] **#364** Win streak — tracked in localStorage, shown on GameOver screen (free play, streak ≥ 2)
- [x] **#363** Campaign replay modifiers — ReplayBriefingScreen shown before replay; minimum difficulty locked to earned tier; optional harder tiers give bonus crystals; activeModifierCount stored in RunState
- [x] **#362** Consumables — health_potion (15 HP, 15💎) + extra_life / Second Wind (+1 life, 30💎); Shop always-in-stock, Merchant mid-run, reward pool drops, NodeMap USE bar

---

## 🔵 In Progress

- [ ] **#180** Campaign: extend to 25 acts — Acts 1–6 complete. Remaining acts planned below (1 act per session, sprites deferred).

### Acts 7–25 Plan

| Act | Title | Theme/Tags | Boss AI | Relic |
|-----|-------|------------|---------|-------|
| 7  | The Emberfall Peaks      | `ember`, `volcano`     | `cinderwarlord`    | Magma Core *(+2 ATK when base HP < 50%)* |
| 8  | The Fungal Deep          | `fungal`, `spore`      | `rootqueen`        | Spore Bloom *(units heal 1 HP/turn)* |
| 9  | The Frozen Expanse       | `frost`, `glacier`     | `paleengine`       | Frost Mantle *(+2 max HP, slow attackers)* |
| 10 | The Sand Market          | `sand`, `mercenary`    | `dunebaron`        | Golden Compass *(+1 mana at battle start)* |
| 11 | The Verdant Canopy       | `canopy`, `ancient`    | `elderwarden`      | Living Bark *(base +15 max HP)* |
| 12 | The Shattered Coast      | `wreck`, `storm`       | `harbormaster`     | Salvage Hook *(revive 1 unit at 1 HP once)* |
| 13 | The Clockwork Vaults     | `clockwork`, `vault`   | `grandautomaton`   | Gear Heart *(+1 ATK & +1 max HP after each win)* |
| 14 | The Plague Fens          | `plague`, `fen`        | `bogsovereign`     | Antitoxin Vial *(base immune to poison; +4 HP)* |
| 15 | The Glass Wastes         | `glass`, `shard`       | `resonantcolossus` | Shard Lens *(mana +1; +1 dmg vs structures)* |
| 16 | The Mirrorlands          | `mirror`, `echo`       | `hollowking`       | Echo Stone *(copy strongest unit at half HP)* |
| 17 | The Abyssal Veil         | `abyss`, `veil`        | `depthsovereign`   | Pressure Seal *(+5 max HP; flying units lose flying)* |
| 18 | The Ashen Crown          | `crown`, `bone`        | `lastwarlord`      | War Banner *(+2 ATK & +2 max HP all units)* |
| 19 | The Rift Bazaar          | `rift`, `bazaar`       | `dealer`           | Loaded Dice *(random unit +5 ATK for 10s once)* |
| 20 | The Sunken Archive       | `archive`, `drowned`   | `knowingeye`       | Scholar's Seal *(draw 1 extra card per battle)* |
| 21 | The Storm Crucible       | `crucible`, `tempest`  | `stormwright`      | Tempest Core *(all units gain flying; base +10 HP)* |
| 22 | The Fracture Frontier    | `fracture`, `frontier` | `boundarywarden`   | Void Anchor *(units can't be debuffed; base +20 HP)* |
| 23 | The Inner Scar           | `scar`, `echo`         | `fractureecho`     | Time Splinter *(reset all unit cooldowns once)* |
| 24 | The Dominion Heart       | `dominion`, `ruin`     | `lastemperor`      | Emperor's Seal *(all relics apply twice)* |
| 25 | The Fracture Core        | `core`, `void`         | `fractureitself`   | The Shard *(run victory item)* |

**Implementation checklist per act:**
- [ ] `web/src/data/acts/actN.json` — 13-node map, boss node, event configs
- [ ] 25 themed cards + unit templates in `web/src/data/cards.json`
- [ ] Boss AI config entry in `web/src/data/bossAIs.json`
- [ ] Relic in `web/src/game/relics.ts`
- [ ] Act import + export in `web/src/game/questline.ts`

**Progress:**
- [x] Act 7 — The Emberfall Peaks (session 26: act7.json, cinderwarlord AI, Magma Core relic; cards/templates already done session 25)
- [x] Act 8 — The Fungal Deep (session 26: 25 cards + templates, act8.json, rootqueen AI, Spore Bloom relic with per-tick heal engine hook)
- [x] Act 9 — The Frozen Expanse (session 27: 25 frost/glacier cards, act9.json, paleengine AI, Frost Mantle relic)
- [x] Act 10 — The Sand Market (session 27: 25 sand/mercenary cards, act10.json, dunebaron AI, Golden Compass relic)
- [x] Act 11 — The Verdant Canopy (session 29: 25 canopy/ancient cards, act11.json, elderwarden AI, Living Bark relic)
- [x] Act 12 — The Shattered Coast (session 29: 26 wreck/storm cards, act12.json, harbormaster AI, Salvage Hook relic)
- [x] Act 13 — The Clockwork Vaults (session 29: 25 clockwork/vault cards, act13.json, grandautomaton AI, Gear Heart relic with engine ATK-on-spawn hook)
- [ ] Act 14 — The Plague Fens
- [ ] Act 15 — The Glass Wastes
- [ ] Act 16 — The Mirrorlands
- [ ] Act 17 — The Abyssal Veil
- [ ] Act 18 — The Ashen Crown
- [ ] Act 19 — The Rift Bazaar
- [ ] Act 20 — The Sunken Archive
- [ ] Act 21 — The Storm Crucible
- [ ] Act 22 — The Fracture Frontier
- [ ] Act 23 — The Inner Scar
- [ ] Act 24 — The Dominion Heart
- [ ] Act 25 — The Fracture Core

### Sprite Generation Backlog (deferred)

All sprites below need creating. Format: `{slug}.svg` (static) + `{slug}-1/2/3.svg` (walk frames) for units; `{slug}.svg` only for structures.

**Act 6 — Sky Dominion** (`sky`, `aerial` tags) ✅ complete (session 35)
- [x] wind-rider (unit, 4 frames)
- [x] sky-sentinel (unit, 4 frames)
- [x] gale-archer (unit, 4 frames)
- [x] thunderhawk (unit, 4 frames)
- [x] cloud-strider (unit, 4 frames)
- [x] lightning-drake (unit, 4 frames)
- [x] storm-petrel (unit, 4 frames)
- [x] zephyr-blade (unit, 4 frames)
- [x] cumulus-golem (unit, 4 frames)
- [x] cyclone-knight (unit, 4 frames)
- [x] sky-leviathan (unit, 4 frames)
- [x] tempest-wraith (unit, 4 frames)
- [x] cloudmarshal-guard (unit, 4 frames)
- [x] nimbus-mage (unit, 4 frames)
- [x] vortex-stalker (unit, 4 frames)
- [x] sky-bastion (structure, 1 frame)
- [x] wind-spire (structure, 1 frame)
- [x] storm-cannon (structure, 1 frame)
- [x] aerie-tower (structure, 1 frame)
- [x] cloud-forge (structure, 1 frame)
- [x] gale-wall (structure, 1 frame)

**Act 7 — The Emberfall Peaks** (`ember`, `volcano` tags) ✅ complete (session 35)
- [x] ember-crawler (unit, 4 frames)
- [x] cinder-hound (unit, 4 frames)
- [x] lava-troll (unit, 4 frames)
- [x] magma-archer (unit, 4 frames)
- [x] ash-stalker (unit, 4 frames)
- [x] fire-salamander (unit, 4 frames)
- [x] volcanic-golem (unit, 4 frames)
- [x] ember-wyrm (unit, 4 frames)
- [x] cinder-knight (unit, 4 frames)
- [x] pyroclast-runner (unit, 4 frames)
- [x] flame-warden (unit, 4 frames)
- [x] molten-colossus (unit, 4 frames)
- [x] ash-revenant (unit, 4 frames)
- [x] scorch-bat (unit, 4 frames)
- [x] inferno-drake (unit, 4 frames)
- [x] magma-vent (structure, 1 frame)
- [x] ember-shrine (structure, 1 frame)
- [x] cinder-wall (structure, 1 frame)
- [x] lava-spire (structure, 1 frame)
- [x] fire-forge (structure, 1 frame)
- [x] ash-turret (structure, 1 frame)

**Act 8 — The Fungal Deep** (`fungal`, `spore` tags) ✅ complete (session 35)
- [x] spore-crawler (unit, 4 frames)
- [x] mycelium-guard (unit, 4 frames)
- [x] spore-archer (unit, 4 frames)
- [x] rot-stalker (unit, 4 frames)
- [x] fungal-shambler (unit, 4 frames)
- [x] bloom-sprite (unit, 4 frames)
- [x] toadstool-knight (unit, 4 frames)
- [x] spore-bat (unit, 4 frames)
- [x] bloom-wisp (unit, 4 frames)
- [x] mycelium-hulk (unit, 4 frames)
- [x] rot-titan (unit, 4 frames)
- [x] spore-colossus (unit, 4 frames)
- [x] root-wraith (unit, 4 frames)
- [x] queen-spore (unit, 4 frames)
- [x] mycelium-wall (structure, 1 frame)
- [x] spore-vent (structure, 1 frame)
- [x] fungal-den (structure, 1 frame)
- [x] root-snare (structure, 1 frame)
- [x] bloom-spire (structure, 1 frame)
- [x] rot-shrine (structure, 1 frame)

**Act 9 — The Frozen Expanse** (`frost`, `glacier` tags) ✅ complete (session 35)
- [x] frost-crawler (unit, 4 frames)
- [x] ice-shard (unit, 4 frames)
- [x] glacier-guard (unit, 4 frames)
- [x] frost-archer (unit, 4 frames)
- [x] blizzard-runner (unit, 4 frames)
- [x] ice-wraith (unit, 4 frames)
- [x] rime-stalker (unit, 4 frames)
- [x] frozen-knight (unit, 4 frames)
- [x] cold-snap (unit, 4 frames)
- [x] avalanche-bear (unit, 4 frames)
- [x] frost-drake (unit, 4 frames)
- [x] glacier-titan (unit, 4 frames)
- [x] ice-colossus (unit, 4 frames)
- [x] permafrost-wyrm (unit, 4 frames)
- [x] ice-wall (structure, 1 frame)
- [x] frost-turret (structure, 1 frame)
- [x] glacier-beacon (structure, 1 frame)
- [x] blizzard-spire (structure, 1 frame)
- [x] cryo-forge (structure, 1 frame)
- [x] pale-shrine (structure, 1 frame)

**Act 10 — The Sand Market** (`sand`, `mercenary` tags) ✅ complete (session 35)
- [x] sand-raider (unit, 4 frames)
- [x] dune-stalker (unit, 4 frames)
- [x] desert-archer (unit, 4 frames)
- [x] sandstorm-runner (unit, 4 frames)
- [x] mirage-blade (unit, 4 frames)
- [x] dune-bat (unit, 4 frames)
- [x] sand-knight (unit, 4 frames)
- [x] mercenary-captain (unit, 4 frames)
- [x] mirage-scout (unit, 4 frames)
- [x] sandstorm-shaman (unit, 4 frames)
- [x] glass-dancer (unit, 4 frames)
- [x] dune-colossus (unit, 4 frames)
- [x] desert-titan (unit, 4 frames)
- [x] sand-wyrm (unit, 4 frames)
- [x] sand-wall (structure, 1 frame)
- [x] oasis-well (structure, 1 frame)
- [x] dune-barracks (structure, 1 frame)
- [x] mirage-tower (structure, 1 frame)
- [x] desert-spire (structure, 1 frame)
- [x] bazaar-post (structure, 1 frame)

**Acts 11–25** — sprite lists to be added as each act is implemented.

---

## 🗺 Roadmap — Pending from CLAUDE.md phases

**Phase 4 — Expansions** (Expansions 5–10 not yet started)
- [ ] Expansion 5 — The Sunken Reef (aquatic, 100 cards + sprites)
- [ ] Expansion 6 — Sky Dominion (aerial, 100 cards + sprites)
- [ ] Expansion 7 — The Goblin Undercity (80 cards + sprites)
- [ ] Expansion 8 — Heroes & Legends (60 legendary cards + sprites)
- [ ] Expansion 9 — The Void Between (80 cards + sprites)
- [ ] Expansion 10 — Community Shard (100 cards + sprites)

**Phase 6 — Game Modes**
- [ ] Card Draft Mode: pick 1 of 3 cards × 8 to build a 24-card deck, then battle (no collection needed)
- [x] **#315** Daily Challenge: fixed-seed deck + opponent each day; track win/loss per day in localStorage

**Phase 7 — Depth & QoL**
- [ ] Card synergy tags: UI labels showing which cards combo well (e.g. "Goblin" tag shared by Goblin, Barracks, Crypt)

---

## 🔴 Bugs — New (from GitHub, session 16 sync)

- [x] **#345** Opponent/player sprites not aligned with unit stop positions — fixed (BASE_STOP_MARGIN raised to 100; sprites at 4px from edge)
- [x] **#328** Black screens between acts — guards + Rollbar logging added; marked fixed
- [x] **#303** Units disappear off the top — fixed: BASE_STOP_MARGIN=0, units now converge to base avatar and stop at x=LANE_WIDTH

## 🔵 Enhancements — New (from GitHub, session 16 sync)

- [x] **#344** Character customisation — CharacterScreen with name + avatar selection exists; avatar used in Battlefield; name applied in boss dialogue and cutscenes
- [x] **#329** Opening a pack — spotlight animation already implemented (card zooms to centre, tap to reveal, returns to grid)
- [ ] **#306** Upgrade/Buff cards — card upgrade and level-up system (see issue for detail)
- [x] **#315** Daily Challenge — fixed-seed deck + opponent each day; track win/loss per day in localStorage (Phase 6 in CLAUDE.md)

---

## 🔵 Enhancements — New (from GitHub, session 15 sync)

- [x] **#319** Rollbar error logging — integrated (session 15)

---

## 🔵 Developer Tools (#314)

- [ ] **#314** Dev mode flag (hidden in Settings behind a debug URL param) with a dev menu to:
  - Trigger rare events at 100% chance on next run
  - Dev mode must not touch main save data (user runs in private/incognito)
- [ ] **#314** Unit tests for game logic (suggest vitest; start with engine.ts pure functions)

---

## 🔵 Architecture — App.tsx Refactor (#316)

Goal: reduce App.tsx from ~1800 lines by extracting logic into custom hooks under `web/src/hooks/`.

### Completed
- [x] `useMusic` — music router + adaptive intensity effects (wired into App.tsx)
- [x] `useRareEvents` — rare event state, trigger effect, rollRareEvent, handleRareEventDone (wired into App.tsx)

### Remaining
- [x] `useAchievements` — done (session 16)
- [x] Extract `CampaignVictoryScreen` component — done
- [x] Extract `CampaignFailedScreen` component — done
- [x] Move `applyPlayerName` to `questline.ts` — done (remaining helpers are bridging functions best left in App.tsx)
- [ ] `useCampaign` — largest extraction: `handleCampaign`, `handleAbandonRun`, act-transition logic, cutscene/nodemap/actcomplete screen routing, run state mutations. ~25+ state dependencies; needs a dedicated session.
- [ ] Close GitHub issue #316 once App.tsx is under ~800 lines

---

## 🔵 Enhancements — New (from GitHub, session 14 sync)

- [ ] **#295** Boss fight — further boss improvements (check issue for detail)
- [ ] **#294** Card upgrade and level up — in-battle or collection card levelling system
- [ ] **#210** Upgrade Buildings in Battles — allow upgrading existing battlefield structures mid-battle
- [ ] **#302** Virtual pet — companion/pet mechanic (large feature)
- [ ] **#301** Seasons — seasonal content rotation (large feature)

---

## 🟠 Active Work

### #296 — Shop Improvements ✅

- [x] Add named NPC shopkeepers (owner, apprentice + others) with daily rotation
- [x] Day shift (6am–6pm) and night shift (6pm–6am) with separate NPC pools
- [x] Shop sells 3 daily specific cards (deterministic by date, priced by rarity)
- [x] Track daily purchase state in localStorage (`jarv_shop_daily`)
- [x] Weekend mode: 3 sell slots for useless items (vs 1 on weekdays)
- [x] Apprentice NPC: 10% discount on weekends, accepts select items
- [x] Countdown timer showing time until next shop reset
- [x] Improved shop visual design (NPC banner, section headers, deal tiles)

---

### Session 13 — Add Missing Expansion Cards

Add all missing cards from Verdant Shard, Iron Citadel, Ashen Wastes, and Crystal Spire expansions per CLAUDE.md roadmap (Phase 4):

**Verdant Shard** (missing): Dryad Sentinel, Mushroom Hulk, Pixie Scout, Swamp Lurker, Moss Golem + Spore Tower, Mushroom Circle, Root Network + Overgrowth, Nature's Bounty, Spore Cloud, Root Bind, Wild Surge

**Iron Citadel** (missing): Battering Ram Crew, Cavalry Scout, Demolitions Expert, Sappers, Ballista Crew + Siege Tower, Fortified Wall, Moat + Battle Hardened, Iron Discipline, Siege Protocol, Tactical Retreat

**Ashen Wastes** (missing): Shadow Stalker, Soulrend Witch, Bone Colossus, Wraith + Death Altar, Necrotic Pool, Graveblight Tower + Undying Rage, Soul Harvest, Plague Spread, Dark Ritual, Entropy Wave

**Crystal Spire** (missing): Techno Imp, Mana Siphon, Arcane Turret, Void Elemental, Chronomancer + Arcane Forge, Null Field + Crystal Resonance, Void Tap, Temporal Loop

- [x] Add Verdant Shard cards to cards.json + sprites (5 units + 3 structures + 5 upgrades)
- [x] Add Iron Citadel cards to cards.json + sprites (5 units + 3 structures + 4 upgrades)
- [x] Add Ashen Wastes cards to cards.json + sprites (4 units + 3 structures + 5 upgrades)
- [x] Add Crystal Spire cards to cards.json + sprites (5 units + 2 structures + 3 upgrades)
- Total: 47 new cards + 84 sprite files added

---

### Battlefield layer system (8-bit mode + composable environments)

Refactor battlefield backgrounds from monolithic inline SVGs into layered SVG files.
Each file is a 100×220 viewBox SVG drawing only in its designated area (transparent elsewhere).
`battlefield.json` lists layer names per environment. A `BattlefieldBackground` component
renders stacked `<img>` elements — `image-rendering: pixelated` in 8-bit mode works for free.

- [x] Create `web/src/game/battlefield.json` (environment → layer list)
- [x] Write floor layer SVGs: `floor-grass`, `floor-mud`, `floor-stone`, `floor-rubble`, `floor-scorched`
- [x] Write side-fill layer SVGs: `field-left`, `dirt-right`, `rubble-left`, `rubble-right`, `mud-edge-left`, `mud-edge-right`, `cobble-left`, `cobble-right`, `ash-left`, `ash-right`
- [x] Write path layer SVGs: `path-dirt-center`, `path-ruins-center`, `path-camp-center`, `path-flagstone-center`, `path-char-center`
- [x] Extract terrain obstacle SVGs to files (rock, tree, pine-tree, fruit-tree, water, ruin, farmhouse, watchtower)
- [x] Replace `LaneBg*` functions in Battlefield.tsx with `BattlefieldBackground` component
- [x] Add 8-bit CSS: `html.eightbit-mode .lane-layer { image-rendering: pixelated }`

---


### Title Screen Idle Animation (branch: claude/title-screen-idle-animation-PNLCb)

After 30s inactivity on title screen, a random unit walks on from a random side, stops in the centre, shows a speech bubble (lore / kill count / random fact), then walks off after 30s. Tapping while visible makes it run off. Achievement for seeing it.

- [x] Create `TitleIdleAnimation.tsx` component (inactivity timer, walk-in/out animation, speech bubble)
- [x] Add CSS to `styles.css` (walk slide-in/out keyframes, sprite walk cycle, speech bubble)
- [x] Integrate into `TitleScreen.tsx`
- [x] Add achievements: `misc:title_idle_seen` (1×, 10×, 100×) + `misc:title_idle_tap` (dismiss 1×, 10×)

---

### Shop "The Needy" achievement
- [x] Add `misc:shop_broke_click` achievement def to `achievements.ts` (target 10, reward crystals)
- [x] Wire `ShopScreen.tsx` buy button to call `incrementAchievementProgress` when can't afford

---

### Session 12 — Fix daily login reward not showing

- [x] Daily reward was being marked as claimed on app load before user saw the modal
- [x] Split `claimDailyReward` into `peekDailyReward` (compute only) + `markDailyRewardClaimed`
- [x] Reward is now only granted + marked claimed when user taps CLAIM

---

### Session 11 — Collection filter popup

- [x] Replace scrollable filter bar with popup filter menu (TYPE, RARITY, SPECIAL)
- [x] Add TAG multi-select filter (UnitTag: flying, ranged, melee, etc.)
- [x] Add AFFINITY filter (has affinity / by effectType)

---

### Session 10 — #100 / #158 / #159: Unit Traits, Strengths/Weaknesses, Affinities

**Design summary:**
Three related systems that give units personality and strategic depth, all driven by new fields in `cards.json` and wired into `engine.ts`.

---

#### System 1 — Target Priority (#100)
Units get a `targetPriority` field that biases `findAttackTarget` in `engine.ts`:
- `walls` — prefers attacking walls first (siege units: Catapult, Ballista, Siege Engineer, Mammoth, Giant)
- `buildings` — prefers structures over mobile units (Rogue, Bandit, Dark Elf — infiltrators)
- `boss` — focuses on hero/boss units (Executioner, Harpy)
- `ranged_first` — targets ranged/weakest units first (Goblin, Plague Rat, Bat — opportunists)
- *(default/omitted)* — current nearest-enemy logic unchanged

---

#### System 2 — Strengths & Weaknesses (#158)
Each unit gets `tags: string[]`, `strengths: string[]`, `weaknesses: string[]` in `cards.json`.

**Tags used:**
`flying`, `ranged`, `melee`, `fast` (speed > 48), `slow` (speed < 13), `large` (maxHp > 50), `magic`, `undead`, `beast`, `armored`, `siege`, `fire`

**Damage formula** (applied in `engine.ts` combat):
- If any of target's tags match attacker's `strengths` → ×1.5 damage
- If any of attacker's tags match defender's `weaknesses` → ×1.5 damage (same check, different framing)
- Both can apply → max ×1.5 (not stacked ×2.25)

**Strengths / Weaknesses per unit:**

| Unit | Strengths (deals ×1.5 to tags) | Weaknesses (takes ×1.5 from tags) |
|------|-------------------------------|----------------------------------|
| Goblin | ranged, magic | large, siege |
| Archer | flying, slow | melee, fast |
| Dragon | melee, armored | magic, ranged |
| Skeleton | melee, slow | fire, magic |
| Troll | melee, fast | fire, siege |
| Crossbow | large, armored | fast, melee |
| Paladin | undead, beast | magic, siege |
| Rogue | siege, ranged | melee, large |
| Catapult | large, slow | fast, fire |
| Werewolf | slow, armored | fire, ranged |
| Golem | melee, fast | magic, siege |
| Pixie | melee, slow | ranged, armored |
| Ogre | fast, melee | ranged, magic |
| Plague Rat | slow, armored | fire, magic |
| Bandit | slow, ranged | melee, large |
| Bat | melee, slow | ranged, magic |
| Scorpion | fast, beast | fire, ranged |
| Shield Guard | ranged, melee | siege, magic |
| Centaur | melee, slow | magic, large |
| Harpy | melee, slow | ranged, magic |
| Specter | melee, armored | magic, ranged |
| Lizardman | ranged, siege | fire, magic |
| Ballista | large, flying | fast, melee |
| Vampire | melee, slow | fire, magic |
| Griffin | melee, beast | ranged, magic |
| Fire Mage | undead, beast | melee, fast |
| Executioner | armored, large | ranged, magic |
| Mammoth | melee, siege | ranged, magic |
| Dark Elf | armored, slow | fire, melee |
| Necromancer | melee, armored | fire, ranged |
| Giant | melee, siege | ranged, magic |
| Wyvern | melee, armored | ranged, magic |
| Behemoth | melee, fast | siege, magic |
| Vine Golem | melee, fast | fire, ranged |
| Spore Bat | melee, slow | ranged, fire |
| Thornbeast | melee, fast | fire, ranged |
| Elder Treant | melee, beast | fire, siege |
| Frog Knight | ranged, slow | magic, siege |
| Ironclad Guard | ranged, melee | siege, magic |
| War Drummer | melee, fast | ranged, magic |
| Siege Engineer | large, armored | fast, melee |
| Shield Wall | ranged, fast | siege, magic |
| Grizzled Vet. | undead, beast | ranged, magic |
| Bone Archer | flying, slow | fire, melee |
| Wight Knight | melee, armored | fire, magic |
| Ash Elemental | melee, beast | ranged, magic |
| Revenant | melee, slow | fire, magic |
| Lich Apprentice | melee, beast | fire, ranged |

---

#### System 3 — Affinities (#159)
Each unit gets an optional `affinity` object: `{ withName: string; range: number; effectType: 'attackSpeed'|'damage'|'moveSpeed'; effectAmount: number; label: string }`.

Each engine tick, for each unit, check if a same-owner ally with `name === affinity.withName` (or same name for self-stacking) is within `affinity.range` px. If so, set runtime flag `affinityActive = true` and apply the effect.

**Affinity table:**

| Unit | Allies With | Range | Effect | Label |
|------|------------|-------|--------|-------|
| Archer | Archer | 60 | attackSpeed ×1.3 | Archer's Tempo |
| Dragon | Catapult | 80 | damage ×1.25 | Siege Guard |
| Skeleton | Necromancer | 70 | moveSpeed ×1.4 | Death Rally |
| Goblin | Goblin | 50 | damage ×1.2 | Goblin Mob |
| Paladin | Shield Guard | 60 | damage ×0.8 (reduction) | Holy Shield |
| Rogue | Bandit | 60 | attackSpeed ×1.3 | Cutthroat Pact |
| Werewolf | Werewolf | 70 | damage ×1.25 | Pack Fury |
| Pixie | Pixie | 50 | moveSpeed ×1.3 | Fae Dance |
| Bat | Vampire | 60 | attackSpeed ×1.3 | Blood Frenzy |
| Harpy | Harpy | 60 | damage ×1.2 | Storm Flock |
| Fire Mage | Fire Mage | 70 | damage ×1.3 | Inferno |
| Necromancer | Skeleton | 80 | attackSpeed ×1.25 | Dark Mending |
| Wyvern | Dragon | 80 | damage ×1.25 | Dragonkin |
| Vine Golem | Elder Treant | 70 | damage ×0.8 (reduction) | Forest Bond |
| Spore Bat | Plague Rat | 50 | attackSpeed ×1.3 | Plague Cloud |
| War Drummer | War Drummer | 70 | moveSpeed ×1.3 | War Rhythm |
| Centaur | Centaur | 60 | damage ×1.2 | Stampede |
| Specter | Vampire | 60 | moveSpeed ×1.25 | Haunting |
| Griffin | Ballista | 80 | damage ×1.2 | Aerial Volley |
| Grizzled Vet. | Grizzled Vet. | 60 | damage ×1.2 | Battle Cry |
| Shield Wall | Ironclad Guard | 50 | damage ×0.8 (reduction) | Iron Formation |
| Troll | Golem | 70 | damage ×1.2 | Monster Pact |
| Lizardman | Lizardman | 50 | attackSpeed ×1.3 | Ambush Pack |
| Thornbeast | Vine Golem | 60 | damage ×1.2 | Thorn Garden |
| Elder Treant | Vine Golem | 70 | damage ×1.25 | Ancient Grove |
| Bone Archer | Wight Knight | 60 | attackSpeed ×1.3 | Undead Volley |
| Wight Knight | Revenant | 60 | damage ×0.8 (reduction) | Undead Legion |
| Ash Elemental | Revenant | 60 | damage ×1.25 | Ashen Wrath |
| Revenant | Necromancer | 70 | attackSpeed ×1.3 | Soul Bond |
| Lich Apprentice | Necromancer | 70 | damage ×1.25 | Dark Tutelage |
| Mammoth | Ogre | 70 | damage ×1.2 | Beastmaster |
| Frog Knight | Frog Knight | 50 | moveSpeed ×1.3 | Leap Frog |
| Ogre | Troll | 70 | damage ×1.2 | Brute Alliance |
| Scorpion | Plague Rat | 50 | attackSpeed ×1.25 | Predator Instinct |
| Executioner | Giant | 70 | damage ×1.3 | Giant's Blade |
| Crossbow | Ballista | 70 | attackSpeed ×1.25 | Ranged Formation |
| Bandit | Rogue | 60 | moveSpeed ×1.3 | Shadow Sprint |
| Vampire | Bat | 60 | damage ×1.2 | Nighthunter |
| Ironclad Guard | Shield Wall | 50 | damage ×0.8 (reduction) | Iron Formation |
| Golem | Troll | 70 | damage ×1.2 | Monster Pact |
| Siege Engineer | Catapult | 80 | damage ×1.3 | Siege Mastery |
| Shield Guard | Paladin | 60 | damage ×0.8 (reduction) | Holy Shield |
| Balloon Archer → Bone Archer pairs with Wight Knight already — skip dupes |

---

#### Implementation Steps
- [x] **Step 1** — `types.ts`: add `tags`, `strengths`, `weaknesses`, `targetPriority`, `affinity` to UnitTemplate; `affinityActive` to Unit runtime fields
- [x] **Step 2** — `cards.json`: add all new fields to every unit entry
- [x] **Step 3** — `engine.ts`: targetPriority in `findAttackTarget`
- [x] **Step 4** — `engine.ts`: strength/weakness damage multipliers in combat
- [x] **Step 5** — `engine.ts`: `processAffinities()` per-tick proximity check + apply runtime effects
- [x] **Step 6** — `CardDetailModal.tsx`: display strengths, weaknesses, affinity info
- [x] **Step 7** — `Battlefield.tsx` + `styles.css`: affinity active badge on unit (reuse buff indicator system)

### Session 9 completions (2026-03-15)
- [x] **#175** Per-run escalating modifiers — ReplayModifier types, per-act counts, stacked HP%/interval/hand bonuses, crystalBonus, UI strip in NodePeekModal + battle HUD
- [x] **#174** Broken relic tracking — addBrokenRelic on break; notification shown on RelicSelectScreen; broken relics not shown in list (user preference)
- [x] **#187** CSS optimisation — CLAUDE.md rule, transitions standardised, action-btn--danger shared class, disabled states consolidated
- [x] **Text colour** — --game-text-color-dim/muted CSS vars; 51 hardcoded grays replaced with theme variables
- [x] **#179** Merchant Curiosity slot — probability 20%, price 10–20 crystals, "✦ CURIOSITY" label (was already implemented; tweaked params + label)

- [x] **Phase 7 / CLAUDE.md** Battle summary screen — implemented
- [x] **#173** Boss card mechanic (phase 2 fight after base falls) — implemented
- [x] **#174** Relic break chance + broken relic inventory items — implemented
- [x] **#192** Campaign events: HP bar on EventScreen — implemented
- [x] **#193** Stuck units: `?debug` terrain overlay — implemented

- [x] **Boss fight splash + HP fix**: `bossHpMultiplier` (default ×10) on phase-2 spawn; `⚡ BOSS FIGHT ⚡` overlay auto-dismisses after 2.5 s — implemented
- [x] **Relic break message**: relic icon + name shown on relic select screen when it shattered at act end — implemented
- [x] **#179** Merchant inventory item: 30% chance of 1 unowned item at 8 crystals alongside cards — implemented
- [x] **#171** Mystery node: 10% chance any normal battle node becomes a mystery encounter at runtime — `MysteryScreen.tsx`, lore text, `computeReward` reward, "Collect & Continue" — implemented



- [x] **#167** Settings Screen: overflow doesn't scroll on small devices — add `min-height: 0` to `.settings-body`
- [x] **#143** Campaign map: visited nodes full brightness + ✓ tick — already fixed
- [x] **#149** Campaign events: acts 2/3 reuse Act 1 text — already fixed
- [x] **#151** Title screen "Deck: X cards" label — already fixed
- [x] **#155** Inventory item pool + random rewards across all act events (see UX section)
- [x] **Event randomisation** — act2 supply-cache expanded from deterministic single-choice pools to full random-outcome pools; `gainItem` (random pool, no itemId) added to events in acts 2, 3, 4

---

## 🟡 UX / UI Bugs (session 6 — new)

- [x] **#183** Intro Screen: fade between "Awesome Software" and "A Jarv Creation" shows the title screen behind it — already fixed
- [x] **#189** Campaign intel: peek modal truncates enemy deck list with "+N more" — fixed; `playstyleDescription` now lists full deck
- [x] **#184** Settings: text size setting doesn't change anything — apply `zoom` to `.game-container` scaled by textSize/14; compensate height — needs manual close on GitHub
- [x] **#185** Settings: text colour setting doesn't change anything — fix circular CSS variable `--game-text-color: var(--game-text-color)` → `#33ff33` — needs manual close on GitHub
- [x] **#186** Achievements: add an indicator/badge on the achievements button on the title screen when there's an unclaimed reward — red `!` badge shown when any achievement is unlocked but unclaimed

---

## 🔴 Critical Bugs

- [x] **#97** Campaign: Act 2 event/shrine nodes launch a battle instead — fixed by user's "add events" commit (supply-cache/goblin-deal/wanderer/ambush-merchant added to events.json) — needs manual close on GitHub
- [x] **#53** Campaign soft-lock: `pendingNodeId` left set blocks map; blank screen at act end; validate/repair all localStorage on load
- [x] **#56** Campaign run-count text always says "fifth time" after run 5 — fix to use actual count
- [x] **Intro always says "tenth"** (no issue#) — runs 11–24 (and 26–49 etc.) still show milestone run text
- [x] **#90** Campaign events (shrine/ruins): result screen dismisses too fast — EventScreen already has CONTINUE button; already fixed — needs manual close on GitHub

---

## 🟠 Gameplay Bugs (new)

- [x] **#148** Cheating: refreshing during a battle resets it — already fixed
- [x] **#149** Campaign events: events in acts 2/3 reuse Act 1 text — already fixed

---

## 🟠 Gameplay Bugs

- [x] **#110** Points: winner could end up with fewer points than loser — fixed: winner gets +500 victory bonus in `checkGameOver` — needs manual close on GitHub
- [x] **#99** Obstacle avoidance: units give obstacles way too much clearance — reduce buffer zone around obstacle hitboxes (pushDist: obs.radius+55 → obs.radius+22)
- [x] **#86** Rewards screen: crystal amount not displayed — already fixed in PostBattleReward component (`+{crystals} ◆`) — needs manual close on GitHub
- [x] **#80** Difficulty scaling: each subsequent run reduces node handicap by 2 and raises opponent HP by 10 (via resolvedNodeOpts helper in App.tsx)

 - [x] **#63** Unit movement: units don't avoid obstacles properly (hitbox mismatch with SVG size) (closed on GitHub)
 - [x] **#62** Gameplay balance: Farm upgrade mana bug; structure cost vs unit cost balance (closed on GitHub)
- [x] **#87** Inventory: item detail modal when tapping a card; relics appear in inventory with icon, name, desc
- [x] **#88** Event rewards: shrines and watchtowers should occasionally give inventory/relic items (not just HP/crystals/cards)

---

## 🟡 UX / UI Bugs (new)

- [x] **#155** Inventory items: too many duplicate items granted — 423 items in `items.json`, unified `rewards.json`, weight-based `computeReward()` with dupe-skipping, daily login + all campaign events feed through same system; `gainItem` entries in all act event nodes draw from random pool
- [x] **#151** Title screen: "Deck: X cards" label is confusing — replace with a badge on Deck Builder button when unused cards exist; show "Collection X/Y" (unlocked/total) instead
- [x] **#143** Campaign map: visited nodes should render at full brightness with a solid fill and a ✓ tick overlay

---

## 🟡 UX / UI Bugs

 - [x] **#58** Screen size: battlefield + hand don't fit on small phone screens — scale to viewport (closed on GitHub)
- [x] **#65** Collection screen: Upgrade/Sell buttons always visible (greyed when unavailable), add text labels
- [x] **#46** UI consistency: title screen buttons same size; collection cards same size; victory screen buttons same size
- [x] **#109** Battery drain: game drains phone battery quickly — pause game loop when tab hidden; prefers-reduced-motion CSS
- [x] **#112** Buff cards UX: players can't tell if buff applies to current units or full battle duration — show status icons above buffed units and/or a HUD indicator for duration buffs

---

## 🟢 Enhancements — High Value

- [x] **#51** Daily login rewards: wire DailyLoginModal + InventoryScreen into App.tsx (files exist, not integrated)
- [x] **#57** Campaign shrines: hide expected rewards; randomise options; one option can be negative
 - [x] **#59** Campaign QoL: hint after 2 failed attempts; crystals as battle reward; explain merchant when broke (closed on GitHub)
- [x] **#61** Battlefield: buildings spread across multiple rows from centre; upgrade level visual feedback
- [x] **#49** Deck builder: add sort / filter / search (already implemented — closing)
 - [x] **#48** Deck builder filter labels: now use full words (Units, Structs, Upgrades, Common, Uncommon, Rare, Legendary, + TYPE/RARITY/SORT group labels) (closed on GitHub)
- [x] **#73** Campaign hack: page refresh now auto-resumes into the active battle (no title screen shown) — needs manual close
- [x] **#50** Sound: better battle music; death cries; crash sound for buildings (already implemented — needs manual close)
- [x] **#60** Rare event — The Gambler: tap-to-guess modal; win all cards or game reset; rubber chicken consolation; history tracking — needs manual close

---

## 🔵 Enhancements — Medium (new)

- [x] **#150** Handle updates: auto-reload the PWA when a new version is deployed; show build ID in Settings → About — already fixed
- [x] **#146** Achievements: add "Campaign Failed" achievement; "100 Losses" and "1000 Losses" milestones
- [x] **#140** Act 4 achievements: no achievements currently fire for Act 4 completion — wire up the same hooks as Acts 1–3

---

## 🔵 Enhancements — Medium

- [ ] **#64 / #115 / #116** Tutorials: deck builder tutorial (#115); gameplay tutorial (#116)
- [x] **#117** Lock campaign until 30 cards collected; show hint to play Quick Battle — done
- [x] **#47** Buff/upgrade cards need icons/images (already implemented in CardTile.tsx UpgradeIcon)
- [ ] **#66 / #118** Debugging: feedback/bug submission screen (#118); access submissions when planning todos (#118)
- [x] **#119** Export/import localStorage to file behind `?debug` URL param — added to Settings page
- [ ] **#60** Rare event — The Gambler: tap-to-guess modal, win all cards or lose everything; rubber chicken consolation; track rare event log
- [ ] **#52** More secrets scattered through the game
- [ ] **#55** Anti-hacking: checksum on card collection + inventory; warn on mismatch; safe first-load migration

---

## 🟣 Relic System (Phase 3 — partial)

- [x] **Relic storage** — `RunState.activeRelic` added; saved to `jarv_relics` on act complete; auto-equipped for next run; effects applied at battle start
- [x] Relic data in `web/src/game/relics.ts` (Bark Shield + Iron Standard defined)
- [x] Relic effects applied at campaign battle start in `App.tsx`
- [x] Relic display on Battlefield HUD
- [x] Relic selection screen between acts (currently auto-equips last earned)

---

## 🗺️ Campaign Acts

- [x] Act 2 — The Iron Citadel: act2.json node map, boss Warlord Kragg, Iron Standard relic
- [x] Act 3 — The Ashen Wastes: act3.json node map, boss The Ashwalker, Soulstone relic
- [x] Act 4 — The Crystal Spire: act4.json (4-wide, 9 rows), boss The Archivist (infinite mana at turn 8+), Prism Lens relic
- [x] Expand Acts 1–3 to be longer/wider (4 cols wide, more rows like act4)
- [ ] Act 5 — The Fractured Core (future)

---

## 🟣 Enhancements — Pending

- [x] **#100** Target priority — implemented (session 10; `targetPriority` field in engine.ts)
- [ ] **#100** (partial) Unit avoidance / fleeing behaviours — still outstanding
- [x] **#102** Achievements system: per-unit/building kill milestones (1000/10000), witty names, rewards (cards/crystals/items), Gambler/rubber-chicken achievements, act-completion counts, dedicated achievements screen

## ⚪ Features — Large / Long-term (new)

- [ ] **#156** Hero card preview: title screen button → page showing all Hero Cards; tap opens card detail modal with lore
- [ ] **#158 / #157** Strengths & weaknesses: each unit gets 2 strengths and 2 weaknesses (e.g. Catapult weak to fire; Archer strong vs flying/slow, weak vs melee/fast); shown in card detail modal; applied as damage multipliers in engine (#157 is a duplicate of #158)
- [ ] **#159** Affinity system: units near same-type or paired units gain a buff or special ability (e.g. Archers near Archers → "Archer's Tempo" faster fire rate; Dragon flies over Catapult to protect it; Skeletons rally to Necromancer); design affinities for all units
- [ ] **#152** Endless mode: continuous waves — opponent dies, stronger one spawns; buildings limited to 3 rows; survive as long as possible; survival-time achievements

---

## ⚪ Features — Large / Long-term

 - [x] **#54** Intro screen: "Awesome Software Presents" logo → Jarv SVG → title (skip setting in settings) (closed on GitHub)
- [ ] **#44** Battlefield z-order: water → rocks → walls → trees → surroundings; units above walls, under canopy; flyers above all
- [ ] **#45** Battlefield scenery themed to environment (rocks/water/ice/canyon)
- [x] **#43** Flying units cast a shadow (already implemented)
- [ ] **#61 / #113** Battlefield: projectile animations; damage/blood augments on sprites; death/climb animations; animation variety (climbing, taking damage, dying, killing) (#113)
- [ ] **#114** Opponent graphics: replace HP bars with a sprite for each player; unique enemy sprite per campaign level
- [ ] **#68** Dark / Light mode toggle in settings
- [ ] **#67** Cross-device persistent game state (design only for now)

---

## 🔵 Enhancements — Architecture

- [x] **#78** External config files: move card definitions, campaign acts, events, and merchant data out of TypeScript into JSON config files with a generic loader

---

## 🗺️ Acts System — Sub-issues from #144 (see docs/acts.md)

Sub-issues created for each unimplemented item from the closed #144. Reference `docs/acts.md` for full specs.

### Campaign Map
- [x] **#171** Mystery node — implemented (runtime 10% chance on any battle node)
- [x] **#172** Node peek modal — implemented

### Boss Mechanic
- [x] **#173** Boss card mechanic — implemented

### Campaign Structure
- [ ] **#180** Extend campaign to 25 acts (currently 4); plan and write acts 5–25 story, node maps, bosses, relics, hero cards, themed card sets
- [ ] **#181** Second 25-act story arc: after act 25 completes, a new 25-act arc begins in the same world with a new plot

### Replay System
- [x] **#175** Per-run modifiers — implemented
- [ ] **#144** Boss dialogue run-awareness: support substitution tags (`{n}`, `{ordinalLower}`) inside `bossDialogue` strings (currently plain text only)
- [ ] **#144** Global word substitution config: a separate JSON file (`web/src/data/wordVariants.json`) holding single-word alternate arrays usable as `{word:key}` tags in any act text

### Relics
- [x] **#174** Relic selection screen + breaking: 50% break chance on completion; broken relics removed from pool and become unique inventory items (broken-relics.json); re-earn by replaying the act

### Lives System
- [x] **#144** Add 3 lives to RunState (`livesRemaining`, `maxLives`); on battle loss player loses 1 life and can retry; at 0 lives show Campaign Failed screen (+50 crystals reward); lives reset to min 3 at act completion; relics/events can grant lives up to 9; shown in NodeMap HUD; "Nine Lives" achievement
- [x] **#144** Campaign Failed screen: 50 crystal reward, clear run, return to menu

### Cards
- [x] **#177** Add `lore` field to card schema — lore moved inline to each card/heroCard object in `cards.json`; `cards.ts` updated to read inline field
- [ ] **#178** Per-act themed card sets: at least 25 cards per act, tagged to that act's theme, earnable only in that act (except daily/crystal rewards)

### Music
- [x] **#144** Refactor sound.ts: export `MusicTrackConfig` type and `startMusicTrack`/`stopMusicTrack` generic API; named config objects (`BATTLE_MUSIC`, `TITLE_MUSIC`, `MAP_MUSIC`, etc.) passable to the engine; per-act wiring remains a future task
- [x] **#176** Per-act music: `mapMusicId`, `battleMusicId`, `bossMusicId` added to Act interface + act JSONs; music router uses act overrides with fallback to defaults; `MUSIC_TRACKS` registry exported from sound.ts

### Merchant
- [x] **#179** Merchant rarely offers an inventory item alongside cards — implemented

---

## ✅ Done

- [x] Daily login reward system created (files only — integration pending above)
- [x] **#53** Campaign soft-lock fixed (pendingNodeId resume, run validation, actcomplete guard)
- [x] **#56** Campaign run-count ordinal text fixed (sixth/seventh/eighth/ninth)

> Note: GitHub API issue closing requires auth token (`GITHUB_TOKEN`). Issues must be closed manually or token added to env. Always check for a local .env file, if one doesn't exist update this file to note what has changed, and that the todo is complete.
> Issues to close manually after merging: none outstanding (all previously flagged are closed)
