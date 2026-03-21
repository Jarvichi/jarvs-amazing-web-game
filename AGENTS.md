# Jarv's Amazing Web Game — Agent & Claude Documentation

> **Pending work:** [`todo.md`](todo.md) — single source of truth for all tasks and GitHub issues.

---

## Development and Token Use
Use tokens sparingly. Carry out changes in small steps; commit and push between each step (even if incomplete). Each task should have a clear, actionable plan.

## Git Workflow — Avoiding Conflicts
Before starting any new work, always rebase onto the latest `main`:
```bash
git fetch origin main
git rebase origin/main
```
This replays unmerged commits on top of updated main and drops already-merged ones automatically.

- **Never use `git reset --hard origin/main`** — discards unmerged commits.
- If rebase produces an empty-patch conflict (commit already merged), resolve with `git rebase --skip`.
- After a rebase, push with `--force-with-lease`.

## PC vs Mobile Development
On PC: use `gh` CLI and read `.env` for tokens. On mobile/cloud: use `curl` for GitHub API access.

## Reading Issues From GitHub
Read the full issue text. Break multiple requirements into sub-tasks tracked in `todo.md` or as GitHub sub-issues. Only close the parent issue once all parts are complete.

**Before starting work on any issue:** check the issue on GitHub to confirm it is still open and has no recent commit/PR that already resolves it. Do not implement work that is already done.
```bash
curl -s "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>" | python3 -c "import json,sys; i=json.load(sys.stdin); print(i['state'], i.get('closed_at',''))"
```

## Tidying Up GitHub
Check branches on GitHub; close any that are stale with no outstanding PRs or unmerged code.

---

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
- **Combat:** Real-time tick-based; melee targets walls first, ranged bypasses walls
- **Opponent AI:** Plays affordable cards on a timer from its own shuffled deck
- **Win:** Destroy the enemy base. **Lose:** Your base reaches 0 HP.

---

## Error Logging Standard

- **React components / App.tsx:** import `rollbar` from `./rollbar` and call `rollbar.error(msg, context)`.
- **Game logic files (`src/game/`):** import `logError` from `'../logger'` — never import rollbar directly.
- **localStorage writes** must always be wrapped in `try/catch` with `logError` in the catch.
- **Silent swallowing is banned** for anything user-impacting. `catch { /* ignore */ }` only for fire-and-forget operations (analytics pings).
- `logger.ts` is initialised in `main.tsx` with the real Rollbar instance. No-op by default in tests/Node scripts.

## CSS Styling Rules
Reuse existing CSS classes before adding new ones. Check whether `action-btn`, `action-btn--gold`, `action-btn--danger`, or `filter-btn` can be used. Duplicate CSS causes visual inconsistency. If an existing class has a specific name that could be more generic, rename and refactor it.

Key shared button classes:
- `action-btn` — primary green action button (the default)
- `action-btn--large` — larger variant with pulse animation
- `action-btn--gold` — gold/yellow variant for rewards and economy actions
- `action-btn--danger` — red variant for destructive/abandon actions
- `filter-btn` — compact filter/toggle button

## Constants vs JSON Config
Complex constants that are likely to be extended (multiplicity) should be JSON config files, or added to an existing JSON file if colocating makes sense.

## Permissions
- Claude has full permission to push and merge code changes

---

## GitHub Issues Workflow

**GitHub Issues are the primary way users log bugs and suggestions.**

At the start of every session (or when asked):
1. Fetch open issues: `curl -s "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues?state=open&per_page=50"`
2. Prioritise by: **critical bugs → gameplay bugs → UX bugs → enhancements → large features**
3. Add new issues to `todo.md` with their GitHub issue number
4. Commit `todo.md` before starting any work
5. After fixing an issue, close it via the API:
   ```bash
   curl -s -X POST "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>/comments" \
     -H "Authorization: token $GITHUB_TOKEN" \
     -d "{\"body\": \"<comment>\"}"
   curl -s -X PATCH "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>" \
     -H "Authorization: token $GITHUB_TOKEN" \
     -d "{\"state\": \"closed\"}"
   ```

### Branch Naming
- Issue branch: `<issue-number>-<short-description>`
- Dependent branches: `<issue-number>-part-<1|2|3>`
- Non-issue (direct prompt): `<DD-MM-YY-HHMM>-<short-description>`

## Todo Tracking Workflow

For every piece of work:
1. Update `todo.md` (include GitHub issue number if applicable)
2. Commit `todo.md` **before** starting work
3. Do the work, commit, and push
4. Mark done in `todo.md`, commit and push
5. Close the GitHub issue with a comment

---

## Sprites / Graphics

Every unit and building needs a sprite. **Create sprites before marking a task complete.**

### Sprite files
- Location: `web/public/sprites/`
- Format: SVG, 32×32 viewBox, simple geometric shapes
- Naming: `unit.name` lowercased, non-alphanumeric runs replaced with `-`
  - e.g. "Fire Mage" → `fire-mage.svg`, "Anc. Altar" → `anc-altar.svg`
- Special overrides go in `web/src/game/sprites.ts` NAME_MAP

### Per-unit files (mobile units need 4 files)
| File | Purpose |
|---|---|
| `{slug}.svg` | Static fallback (same as frame 2) |
| `{slug}-1.svg` | Walk frame 1 — stride A |
| `{slug}-2.svg` | Walk frame 2 — mid-stride, body 1 px higher |
| `{slug}-3.svg` | Walk frame 3 — stride B (opposite of frame 1) |

### Buildings (static only)
One file: `{slug}.svg` — no animation frames needed.

### Workflow
**Create one graphic, commit, push, then do the next.** Do not batch sprites.
```bash
git add web/public/sprites/{slug}*.svg
git commit -m "Add {Name} sprite"
git push -u origin <branch>
```

## GitHub & PRs
- Authenticated as: Jarvichi
- Default base branch: `main`
- Deployment triggers automatically on merge to `main`

---

## Acts — Design Rules

All rules for acts, the campaign map, node types, relics, heroes, lives system, music, and card authoring are in **[`docs/acts.md`](docs/acts.md)**. Read it before:
- Creating or modifying act JSON files (`web/src/data/acts/*.json`)
- Adding new node types, relics, hero cards, or boss mechanics
- Authoring campaign story text or replay variants

The doc also contains the **Act Authoring Checklist** (§12) — run through it for every new act.

---

## Campaign Event Checklist

When creating or modifying act files, ensure any new `eventId` values are present in `web/src/data/events.json` or handled by generator functions:

- **Named catalog entry:** add to `catalog` in `events.json` with `id`, `title`, `description`, `choices`.
- **Procedural:** add a generator in `questline.ts` and register in `EVENT_CATALOG`.
- **Act JSON:** `eventId` must exactly match the catalog key.
- **QA:** Run dev server, navigate to the node, confirm it opens the event UI.
- **Assets:** Ensure sprites/card images for any new items/cards are committed.
- **Commit message:** e.g. `feat(campaign): add supply-cache event + act2 node reference`

---

## Design Roadmap

### Lore: The Shattered Dominion

The player is **Jarv**, a wandering tactician who once served the Grand Dominion — shattered by the **Fracture Event**. Each shard has its own culture and cards. Jarv travels shard-to-shard, completing questlines, eventually reaching the **Fractured Core** to undo the cataclysm.

Deck **resets** each act, but collection, mastery, crystals, and relics persist across runs.

### 5-Act Structure

| Act | Shard | Boss | Relic Reward |
|---|---|---|---|
| 1 | The Verdant Shard (forest) | The Thornlord | Bark Shield (+5 HP) |
| 2 | The Iron Citadel (military) | Warlord Kragg | Iron Standard (+1 ATK) |
| 3 | The Ashen Wastes (undead) | The Ashwalker | Soulstone (auto-revive) |
| 4 | The Crystal Spire (arcane) | The Archivist | Prism Lens (+1 mana/turn) |
| 5 | The Fractured Core (final) | The Fracture | Title: Worldmender |

### Node Types
`battle`, `elite`, `boss`, `rest` (+5 HP), `event` (text choice), `merchant` (buy cards), `mystery`

### Relic System

| Relic | Effect | Source |
|---|---|---|
| Bark Shield | +5 base HP | Act 1 reward |
| Iron Standard | Units start with +1 ATK | Act 2 reward |
| Soulstone | One unit auto-revives per battle | Act 3 reward |
| Prism Lens | +1 mana per turn | Act 4 reward |
| Crow's Eye | See opponent's first 2 cards | Elite drop |
| Blood Crystal | Each kill generates 1 crystal | Elite drop |
| Thornmail | Attackers take 1 dmg when hitting your base | Mystery event |
| Wanderer's Map | Start with 1 extra card in hand | Merchant |

### 1000+ Card Collection Roadmap

Expansions 1–4 complete (~95 cards). Expansions 5–10 pending (see `todo.md`).

| Expansion | Theme | Target |
|---|---|---|
| 5 — The Sunken Reef | Aquatic/tidal | 100 cards |
| 6 — Sky Dominion | Aerial/celestial | 100 cards |
| 7 — The Goblin Undercity | Goblin faction | 80 cards |
| 8 — Heroes & Legends | Cross-shard legendaries | 60 cards |
| 9 — The Void Between | Meta/surreal | 80 cards |
| 10 — Community Shard | Player-inspired | 100 cards |
