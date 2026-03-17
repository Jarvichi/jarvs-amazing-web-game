# Jarv's Amazing Web Game — Claude Instructions

## Development and Token Use
Use tokens sparingly, remember that the user has limited tokens, ensure that all changes are carried out in small steps, commit and push between each small change (even if the change isn't complete yet). To aid this each task should have a clear plan created, with each step actionable.

## PC vs Mobile Development
If I'm runniong on a PC I have access to a greater variety of tools, the gh cli for example. I should use the .env file to read and store configuration that aids developement in this environment. The .env file may contain tokens for authentication. When I'm running on mobile or cloud I will have a more restricted capability. I should use the tools avaialble to me such as curl to access GitHub. 

## Reading Issues From GitHub
When reading an issue look at the full issues text, issues might contain several required features and bugs, we should break each of these out into a sub task, keep a log of the sub tasks either in the todo.md or by creating sub tasks in GitHub. Only close the parent issue once all component parts have been completed. 

## Tidying Up GitHub
I should check branches on GitHub and close down any that are stale, and have no outstanding prs or unmerged code.

## Project Overview
A browser-based strategy card game. Deploy units, build structures, and cast upgrades to destroy the enemy base. The only platform is the web app (`web/`).

- **Live URL:** https://jarvichi.github.io/jarvs-amazing-web-game/
- **Repo:** Jarvichi/jarvs-amazing-web-game on GitHub

## Tech Stack
- React 18, TypeScript 5, Vite 5
- No UI library — custom retro ASCII/terminal styling via `web/src/styles.css`
- No test framework currently

## Project Structure
```
web/
  src/
    game/          # Pure game logic (no React)
      types.ts     # Interfaces: Card, Unit, GameState, Base, effects
      engine.ts    # Core mechanics: mana, combat, opponent AI
      cards.ts     # Card deck (units, structures, upgrades)
    components/    # React UI
      App.tsx          # Root component, game state, phase routing
      Battlefield.tsx  # Main game screen: bases, field, hand, log
      CardTile.tsx     # Individual card rendering
      GameOver.tsx     # Win/lose screen
    styles.css
  package.json
  vite.config.ts   # base: '/jarvs-amazing-web-game/' for GitHub Pages
  tsconfig.json
.github/
  workflows/
    deploy.yml     # Auto-deploys web/dist to GitHub Pages on push to main
```

## Common Commands
All commands run from the `web/` directory:
```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build locally
```

## Game Design
- **Mana system:** Player starts with 3 mana/turn; Farms increase max mana permanently
- **Card types:** Unit (deploy fighters), Structure (build Walls/Farms/Barracks), Upgrade (buff/heal all units)
- **Combat:** All units attack simultaneously at End Turn; melee targets walls first, ranged bypasses walls
- **Opponent AI:** Plays 1–2 affordable cards per turn from its own shuffled deck
- **Win:** Destroy the enemy base (20 HP). **Lose:** Your base reaches 0 HP.

## CSS Styling Rules
Always reuse existing CSS classes rather than writing new ones unless the required functionality is genuinely different. Before adding a new button style, check whether an existing class (e.g. `action-btn`, `action-btn--gold`, `action-btn--danger`) can be used or extended with a small modifier. Duplicate CSS leads to visual inconsistency and maintenance burden. when considering adding new css if there is an existing attribute that could be used that has a specific name, rename and refactor to something more generic. eg "title-screen-button" is specific and could be standardised with a style called "normal-button".
Better still would be to create a component such as "Button" that has props tha allow for some variation, but generally consistent.

Key shared button classes:
- `action-btn` — primary green action button (the default)
- `action-btn--large` — larger variant with pulse animation
- `action-btn--gold` — gold/yellow variant for rewards and economy actions
- `action-btn--danger` — red variant for destructive/abandon actions
- `filter-btn` — compact filter/toggle button

## Constants VS JSON Config
Whenever we add a constant that is more complex than a primitive type we should consider whether that would be better suited as a JSON configuration item. If the entity is likely to be extended (supporting multiplicity) then we should opt to create a JSON file, or add to an existing JSON file if it makes sense to colocate the data.

## Permissions
- Claude has full permission to push and merge code changes

## GitHub Issues Workflow

**GitHub Issues are the primary way users log bugs and suggestions.**

At the start of every session (or when asked):
1. Fetch open issues: `curl -s "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues?state=open&per_page=50"`
2. Review each issue, prioritise by: **critical bugs → gameplay bugs → UX bugs → enhancements → large features**
3. Add new issues to `todo.md` (repo root) with their GitHub issue number
4. Commit `todo.md` immediately before starting any work
5. **After fixing an issue:** close it via the GitHub API with an appropriate comment (requires `GITHUB_TOKEN` in env — if unavailable, note it in todo.md for manual close):
   ```bash
   # Post comment
   curl -s -X POST "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>/comments" \
     -H "Authorization: token $GITHUB_TOKEN" \
     -d "{\"body\": \"<comment>\"}"
   # Close issue
   curl -s -X PATCH "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>" \
     -H "Authorization: token $GITHUB_TOKEN" \
     -d "{\"state\": \"closed\"}"
   ```

## Todo Tracking Workflow

**For every piece of work:**
1. Update `todo.md` with the task (include GitHub issue number if applicable)
2. Commit `todo.md` **before** starting work on it
3. Do the work, commit, and push
4. Mark the item done in `todo.md`, commit and push
5. Close the GitHub issue with a comment

**When completing any todo item in CLAUDE.md's Pending Implementation Todos:**
1. Mark it `[x]` in the "Pending Implementation Todos" section below
2. Immediately commit CLAUDE.md with message: `docs: check off [item name] in todo list`
3. Push to the current branch

This keeps both the todo list and CLAUDE.md accurate across sessions.

## Sprites / Graphics

Every unit and building needs a sprite. **Whenever new units or buildings are added, their sprites must be created before the task is complete.**

### Sprite files
- Location: `web/public/sprites/`
- Format: SVG, 32×32 viewBox, simple geometric shapes
- Naming: derived from `unit.name` by lowercasing and replacing non-alphanumeric runs with `-`
  - e.g. "Fire Mage" → `fire-mage.svg`, "Anc. Altar" → `anc-altar.svg`
- Special overrides go in `web/src/game/sprites.ts` NAME_MAP

### Per-unit files (mobile units need 4 files)
| File | Purpose |
|---|---|
| `{slug}.svg` | Static fallback (same as frame 2) |
| `{slug}-1.svg` | Walk frame 1 — stride A (left arm/leg back, right forward) |
| `{slug}-2.svg` | Walk frame 2 — mid-stride, body 1 px higher |
| `{slug}-3.svg` | Walk frame 3 — stride B (opposite of frame 1) |

### Buildings (static only)
One file: `{slug}.svg` — no animation frames needed.

### Workflow when adding new units/buildings
**Create one graphic, commit, push, then do the next.** Do not batch sprites into a single commit.
```bash
# After writing the 4 SVG files for a unit:
git add web/public/sprites/{slug}*.svg
git commit -m "Add {Name} sprite"
git push -u origin <branch>
# Then move on to the next unit
```

## GitHub & PRs
- Authenticated as: Jarvichi
- Default base branch: `main`
- Deployment triggers automatically on merge to `main`

**Includes / agent guidance:** See [AGENTS.md](AGENTS.md) for agent workflows, campaign event checklist, and issue/PR handling guidance. Agents should follow the `Campaign Event Checklist` there whenever adding or modifying act nodes that reference `eventId` values.

---

## Design Roadmap & Todo List

### Lore: The Shattered Dominion

The player is **Jarv**, a wandering tactician who once served the Grand Dominion — a vast empire shattered by the **Fracture Event**, a magical catastrophe that split the realm into isolated shards. Each shard developed its own culture, creatures, and power structures. Jarv travels shard to shard, building a deck from each region's cards, completing the questline, and eventually trying to reach the **Fractured Core** to undo the cataclysm.

**Core tension:** Every time you complete a quest and receive the shard's reward, your deck **resets** (you return to a starter kit). But your **permanent collection grows**, mastery carries over, and you unlock harder difficulty shards and story progression.

---

### Roguelike Questline — 5-Act Structure

**Act 1 — The Verdant Shard** *(tutorial shard, forested realm)*
- Node map: 5–7 battles, 1 elite, 1 boss
- Boss: The Thornlord (structure-heavy deck)
- Reward: `Relic: Bark Shield` (+5 base HP), unlock Act 2
- Deck reset. Starter pack includes 2x Goblin, 2x Stone Wall, 1x Farm

**Act 2 — The Iron Citadel** *(military shard, fortified ruins)*
- Node map: 6–8 battles, 2 elites, 1 boss
- Elite: The Siege Captain (buff-stacks Catapults)
- Boss: Warlord Kragg (swarm + strong melee)
- Reward: `Relic: Iron Standard` (units start with +1 ATK), unlock Act 3
- Deck reset. Starter pack improved

**Act 3 — The Ashen Wastes** *(post-apocalyptic shard, dark magic)*
- Node map: 7–9 battles, 2 elites, 1 boss
- Elite: The Revenant Witch (resurrects fallen units once)
- Boss: The Ashwalker (sacrifices own units for massive damage bursts)
- Reward: `Relic: Soulstone` (one unit auto-revives per battle), unlock Act 4
- Deck reset. Starter pack includes rare card

**Act 4 — The Crystal Spire** *(arcane shard, magic-tech hybrids)*
- Node map: 8–10 battles, 3 elites, 1 boss + 1 secret boss
- Introduces upgrade-heavy meta
- Boss: The Archivist (infinite mana at turn 8+)
- Secret Boss: The Mirror (copies your deck exactly)
- Reward: `Relic: Prism Lens` (+1 mana per turn), unlock Act 5
- Deck reset. Can choose 1 legendary from collection for starter

**Act 5 — The Fractured Core** *(final shard, reality breaking)*
- Node map: 10 battles, gauntlet format (no heal between)
- All previous bosses appear as elites
- Final Boss: The Fracture (adaptive AI, switches strategy mid-fight)
- Reward: `Title: Worldmender`, cosmetic throne room scene
- Achievement: complete without any shard relic equipped

---

### Roguelike Loop Design

**Node Map:**
- Linear with branches — 3 paths each with different risk/reward
- Node types: `battle`, `elite`, `boss`, `rest` (heal 5 HP), `event` (text adventure choice), `merchant` (spend crystals on cards), `mystery`

**Between Runs:**
- Collection persists across all resets
- Mastery persists
- Crystals persist
- Unlocked shards persist
- Relics are earned once and available to equip at run start (pick 1)

**Run Rewards:**
- Battles: draw 1 card from pool of 3 (keep 1, own forever)
- Elites: draw 1 rare card from pool of 3
- Boss: draw 1 legendary + shard relic + act completion

**Difficulty:**
- Normal, Hard (+20% enemy HP), Nightmare (enemies have relics too)

---

### Relic System

Relics are passive bonuses that persist for a full run (reset on next quest start):

| Relic | Effect | Source |
|---|---|---|
| Bark Shield | +5 base HP | Act 1 reward |
| Iron Standard | Units start with +1 ATK | Act 2 reward |
| Soulstone | One unit auto-revives per battle | Act 3 reward |
| Prism Lens | +1 mana per turn | Act 4 reward |
| Crow's Eye | See opponent's hand (first 2 cards) | Elite drop |
| Blood Crystal | Each kill generates 1 crystal | Elite drop |
| Thornmail | Attackers take 1 damage when hitting your base | Mystery event |
| Wanderer's Map | Start with 1 extra card in hand | Merchant |

---

### 1000+ Card Collection Roadmap

Current cards: ~95. Target: 1000+ across 10 shards/expansions.

**Expansion 1 — Verdant Shard** *(forest/nature)* — 80 cards
- Units: Dryad Sentinel, Vine Golem, Spore Bat, Mushroom Hulk, Thornbeast, Pixie Scout, Elder Treant, Swamp Lurker, Frog Knight, Moss Golem
- Structures: Thornwall, Spore Tower, Root Network, Ancient Grove, Mushroom Circle
- Upgrades: Overgrowth, Nature's Bounty, Spore Cloud, Root Bind, Wild Surge

**Expansion 2 — Iron Citadel** *(military/siege)* — 100 cards
- Units: Siege Engineer, Ironclad Guard, Battering Ram Crew, War Drummer, Ballista Crew, Shield Wall Soldier, Demolitions Expert, Sappers, Cavalry Scout, Grizzled Veteran
- Structures: Siege Tower, Fortified Wall, Barracks II, Armory, Command Tent, Moat
- Upgrades: Battle Hardened, Iron Discipline, Siege Protocol, War Cry, Tactical Retreat

**Expansion 3 — Ashen Wastes** *(undead/dark magic)* — 100 cards
- Units: Bone Archer, Plague Rat, Wight Knight, Revenant, Shadow Stalker, Ash Elemental, Soulrend Witch, Bone Colossus, Wraith, Lich Apprentice
- Structures: Soul Obelisk, Bone Wall, Death Altar, Necrotic Pool, Graveblight Tower
- Upgrades: Undying Rage, Soul Harvest, Plague Spread, Dark Ritual, Entropy Wave

**Expansion 4 — Crystal Spire** *(arcane/tech)* — 100 cards
- Units: Arcane Golem, Mana Wisp, Crystal Hydra, Rune Knight, Spellblade, Techno Imp, Mana Siphon, Arcane Turret, Void Elemental, Chronomancer
- Structures: Mana Tower, Crystal Wall, Arcane Forge, Leyline Node, Null Field
- Upgrades: Mana Surge, Crystal Resonance, Void Tap, Arcane Efficiency, Temporal Loop

**Expansion 5 — The Sunken Reef** *(aquatic/tidal)* — 100 cards
- Units: Crab Knight, Tide Caller, Jellyfish Swarm, Reef Shark Rider, Leviathan Pup, Coral Golem, Sea Witch, Barnacleback, Abyssal Horror, Merfolk Skirmisher
- Structures: Tidal Wall, Reef Tower, Whirlpool Generator, Pressure Dome, Abyssal Gate

**Expansion 6 — Sky Dominion** *(aerial/celestial)* — 100 cards
- Focus: flying units with special aerial combat rules
- Units: Storm Griffin, Cloud Elemental, Lightning Drake, Sky Sentinel, Thunderhawk, Zephyr Sprite, Storm Caller, Celestial Guard, Comet Rider, Windshaper

**Expansion 7 — The Goblin Undercity** *(goblin-centric)* — 80 cards
- Full goblin faction: specialists, inventors, tunnel fighters
- Mechanics: cheap swarm units, sacrifice mechanics, trap structures

**Expansion 8 — Heroes & Legends** *(cross-shard legendary figures)* — 60 cards
- 60 legendary units only, each with unique ability
- Includes: Jarv (playable hero), The Fracture (antagonist), shard bosses

**Expansion 9 — The Void Between** *(meta/surreal expansion)* — 80 cards
- Reality-bending cards that interact with game mechanics
- Includes cards that modify costs, shuffle decks, change base HP targets

**Expansion 10 — Community Shard** *(player-inspired designs)* — 100 cards
- Named after community contributors, meme cards, joke legendaries

---

### Pending Implementation Todos

**Phase 1 — Core Loop**
- [x] Design node map data structure (`web/src/game/questline.ts`)
- [x] Build NodeMap UI component (scrollable left-right with path branches)
- [x] Implement run state: active relics, current act, current node
- [x] Save/load run state to localStorage (`jarv_run`)
- [x] Deck reset mechanic with starter pack selection

**Phase 2 — Campaign**
- [x] Write Act 1 node map data (5 battle nodes, 1 elite, 1 boss)
- [x] Boss AI: Thornlord (structure-heavy — builds walls every turn)
- [x] Implement `rest` node type (heal 5 HP)
- [x] Implement `event` node type (text choice cards with consequences)
- [x] Implement `merchant` node (spend crystals, 3 cards offered)
- [x] Post-battle card reward: pick 1 of 3

**Phase 3 — Relics**
- [x] Relic data in `web/src/game/relics.ts`
- [x] Relic effects applied in engine.ts
- [x] Relic display on Battlefield HUD
- [x] Relic selection screen between acts

**Phase 4 — Expansions**
- [ ] Add Verdant Shard cards (80 cards) with sprites
- [ ] Add Iron Citadel cards (100 cards) with sprites
- [ ] (Remaining expansions follow after)

**Phase 5 — Polish**
- [x] Backstory intro screen (text crawl or panel art)
- [x] Act transition cutscenes (text only, terminal style)
- [x] Boss dialogue lines (1-3 lines per boss encounter)
- [ ] Victory screen for completing full questline

**Phase 6 — Game Modes**
- [ ] Card Draft Mode: free play variant — pick 1 of 3 cards × 8 to build a 24-card deck, then battle (no collection needed)
- [ ] Daily Challenge: fixed-seed deck + opponent each day; track win/loss per day in localStorage

**Phase 7 — Depth & QoL**
- [ ] Opponent card reveal: briefly flash the card name when the opponent plays one (currently invisible)
- [x] Battle summary screen: stats popup after each battle — cards played, kills by unit, damage dealt, turns taken
- [x] Boss Phase 2: bosses change behavior at 40% HP (e.g. Thornlord starts building Farms to flood mana)
- [ ] Card synergy tags: UI labels showing which cards combo well (e.g. "Goblin" tag shared by Goblin, Barracks, Crypt)
- [ ] Codebase health review: audit file sizes and complexity, split any files over ~500 lines, extract shared logic
