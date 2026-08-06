# Jarv's Amazing Web Game — Agent & Claude Documentation

> **Pending work:** [GitHub Issues](https://github.com/Jarvichi/jarvs-amazing-web-game/issues) — single source of truth for all tasks.

---

## Plan Before You Build

**Before implementing any non-trivial change, always present a plan and wait for approval.**

1. Read the issue / request in full
2. Explore the relevant code (read files, search for patterns)
3. Write a concise plan: what files change, what each step does, any risks or trade-offs
4. **Present the plan to the user and ask for permission to proceed**
5. Only start coding once the user approves (or gives feedback to adjust the plan)

This prevents rework — it is far cheaper to adjust a plan than to rewrite code.

## Development and Token Use
Use tokens sparingly. Carry out changes in small steps; commit and push between each step (even if incomplete).

DO NOT USE AGENTS - Unless I explicitly state for you to do so.

## Verifying Changes
`npm run build` (typecheck) and `npm run test` are the default way to verify a change — run them and trust them. Only fall back to launching the dev server and driving it in a browser when you are investigating or confirming a **visual** bug (layout, rendering, sprite/animation, canvas interaction) — not for logic/data changes, even ones that touch UI-adjacent code. Browser verification of this hub-world/PixiJS canvas is expensive (no DOM selectors for in-canvas elements, camera/pathfinding makes reaching a specific NPC slow) — don't reach for it by default.

If browser verification is genuinely warranted: the app needs Firebase env vars to render past a blank white screen (`firebase.ts` calls `initializeApp` with `import.meta.env.VITE_FIREBASE_*`, which are unset by default and throw `auth/invalid-api-key` on load). `web/.env.test` has working fake-but-valid-format keys — copy it to `web/.env.local` (gitignored) before `npm run dev`. Don't commit `.env.local` or leave ad hoc driver scripts in the repo.

`npm run test` (vitest) prints an `Unhandled Error` at the end about `browserType.launch: Executable doesn't exist at .../chrome-headless-shell` during browser-cleanup — this is Storybook's `@vitest/browser-playwright` addon looking for a Playwright browser variant that isn't preinstalled in this environment. It's noise, not a real failure: check the `Test Files`/`Tests` summary line (`N passed`) rather than treating this error as a regression to chase.

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
Read the full issue text. Break multiple requirements into GitHub sub-issues. Only close the parent issue once all parts are complete.

**Before starting work on any issue:** check the issue on GitHub to confirm it is still open and has no recent commit/PR that already resolves it. Do not implement work that is already done.
```bash
curl -s "https://api.github.com/repos/Jarvichi/jarvs-amazing-web-game/issues/<N>" | python3 -c "import json,sys; i=json.load(sys.stdin); print(i['state'], i.get('closed_at',''))"
```

## Tidying Up GitHub
Check branches on GitHub; close any that are stale with no outstanding PRs or unmerged code.

---

## Project Overview
A browser-based strategy card game. Deploy units, build structures, and cast upgrades to destroy the enemy base. The only platform is the web app (`web/`).

- **Live URL:** https://jawg.uk/ (custom domain — previously https://jarvichi.github.io/jarvs-amazing-web-game/)
- **Repo:** Jarvichi/jarvs-amazing-web-game on GitHub

> **Domain note:** The game moved from `jarvichi.github.io/jarvs-amazing-web-game` to the custom domain `jawg.uk`. ServiceWorker and asset URL errors referencing the old GitHub Pages domain are stale/noise. All new deployments go to `jawg.uk`.

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

## Session Setup (Run First)

**Node version is pinned in `.nvmrc` (22).** Both workflows read that same file via
`node-version-file`, and `.devcontainer` matches it — so check `node -v` before trusting a
green local run. A mismatched Node can pass tests locally that fail in CI: Node 21+ defines a
global `navigator` that older versions do not, so anything importing PixiJS outside a browser
environment succeeds locally and dies in CI with `ReferenceError: navigator is not defined`.

`node_modules` is **not committed** to the repo. In every new session (cloud/CI/mobile), run this before any build or dev command:

```bash
cd web && npm install
git restore web/package-lock.json   # discard lock-file changes from this environment's npm
```

`npm install` regenerates `web/package-lock.json` using the local npm version, which differs from the committed version. **Never commit those changes** — doing so breaks CI's dependency cache. Always restore the file immediately after installing.

A pre-commit hook in `.githooks/pre-commit` enforces this automatically. Activate it once per clone:

```bash
git config core.hooksPath .githooks
```

Without this, `npm run build` will fail with `Cannot find module 'react'` and similar errors — the TypeScript compiler cannot resolve any packages.

## Common Commands
All commands run from the `web/` directory:
```bash
npm install      # REQUIRED first — installs all dependencies
npm run dev      # Start dev server
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build locally
```

## Editing via GitHub Codespaces

Storybook (`npm run storybook`, `web/.storybook/`) renders the game's real components,
and several stories (map editor, bundle editor, battlefield editor) save changes by
writing JSON files directly under `web/src/data/...` through custom dev-server
middleware in `web/.storybook/main.ts`. That only works against a live Node process —
not a static Storybook build — so a GitHub Codespace (a hosted dev container) is how to
get this editing experience from any device without a local dev machine.

1. Open a Codespace on this repo/branch: GitHub UI → **Code → Codespaces → Create
   codespace**. `.devcontainer/devcontainer.json` runs `npm install` automatically.
2. Inside the Codespace, run:
   ```bash
   cd web && npm run storybook -- --host 0.0.0.0
   ```
   The `--host 0.0.0.0` flag is required for Codespaces' port forwarding to reach the
   dev server — pass it ad hoc like this rather than adding it to the `storybook`
   script, so local dev on your own machine keeps binding to `localhost` only.
3. Open the forwarded port 6006 (Codespaces will prompt "Open in Browser").
4. Use the map/bundle/battlefield editor stories as normal — saves write real files
   inside the Codespace's filesystem, exactly like local dev.
5. Commit and push from the Codespace (VS Code Web's git UI or the terminal) to persist
   edits to the repo — the Codespace itself is ephemeral, so uncommitted changes are
   lost if it's deleted or reclaimed after its idle timeout.

**Security:** keep the forwarded port's visibility set to **Private** (Codespaces'
default). The editor save endpoints have no authentication of their own — they rely
entirely on Codespaces' private-port GitHub auth to keep them from being reachable by
anyone else. Never switch the port to "Public" while editing.

## Game Design
- **Mana system:** Player starts with 3 mana/turn; Farms increase max mana permanently
- **Card types:** Unit (deploy fighters), Structure (build Walls/Farms/Barracks), Upgrade (buff/heal all units), Area Of Effect (causes damage to an area of the battlefield damaging all units)
- **Combat:** Real-time tick-based; melee targets walls first, ranged bypasses walls
- **Opponent AI:** Plays affordable cards on a timer from its own shuffled deck
- **Win:** Destroy the enemy base. **Lose:** Your base reaches 0 HP.

---

## Cards

Cards have different rarities. Cards will had weaknesses, strengths and affinities to other cards. Cards have a mana cost to use. Cards have assocaited graphics. Cards are stored in Cards.json.

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

## Component Extraction and Storybook Stories

**Break screen-level components into focused sub-components, each with its own story.**

When a screen component grows large, extract its visual pieces into a subfolder named after the screen:
```
components/
  minigames/
    TowerDefence.tsx          ← screen: imports sub-components
    towerdefence/
      AttackEffect.tsx        ← extracted piece
      AttackEffect.stories.tsx
      BottomPanel.tsx
      BottomPanel.stories.tsx
      ...
```

Rules:
- Every extracted component gets a `.stories.tsx` file alongside it — no exceptions.
- The story must cover at least the default visual state so it can be inspected in Storybook.
- Sub-components are pure visual: no game state, no localStorage, props only.
- The parent screen component orchestrates data and passes it down.

**Why:** Isolated Storybook stories let you see each piece independently. Visual bugs (wrong layout, broken animations, missing sprites) are caught at the component level — not buried inside a running game session. This is how the hit-spark animation timing bug was spotted.

**Apply this pattern to all future components, and refactor existing large screens when touching them for other reasons.**

## Card Synergies

Synergy groups and card-to-card combo links are documented in
**[`docs/synergies.md`](docs/synergies.md)**. Read it before:
- Adding or resizing a synergy group (`web/src/data/synergies.json`)
- Adding tags to cards in `web/src/data/cards.json`
- Changing where synergy badges or the deck-builder highlighting appear

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
3. After fixing an issue, close it via the API:
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

## PixiJS Framework

The project uses **PixiJS v8** (`pixi.js` in `web/package.json`) for canvas-based rendering in components with spatial grids, moving entities, or sprite animations.

### When to use PixiJS vs DOM

| Use PixiJS | Use React/DOM |
|---|---|
| Tile/cell grids | Panels, modals, toolbars |
| Moving enemies / walkers | Card hands, stat bars |
| Sprite animations (3-frame) | Text menus, buttons |
| Attack effects / particles | Form inputs, overlays |

### The `usePixiApp` hook

```typescript
import { usePixiApp } from '../../hooks/usePixiApp'

const canvasRef = useRef<HTMLCanvasElement>(null)

usePixiApp(canvasRef, width, height, (app) => {
  // Build scene graph here — runs once after init
  const g = new PIXI.Graphics()
  app.stage.addChild(g)
})

return <canvas ref={canvasRef} width={width} height={height} />
```

The hook creates a `PIXI.Application`, attaches it to the canvas, calls the callback when ready, and destroys it on unmount.

### Scene graph layer conventions

Add children in z-order (first = bottom):
1. Background / terrain (`PIXI.Graphics`)
2. Grid cells / path (`PIXI.Graphics`)
3. Buildings / towers (`PIXI.Sprite`)
4. Units / enemies (`PIXI.AnimatedSprite`)
5. Effects / particles (`PIXI.Graphics`)
6. HUD / HP bars (`PIXI.Graphics`)

### Loading sprites as textures

```typescript
import { loadSpriteTexture, loadAnimFrames } from '../../utils/pixiHelpers'

// Static building sprite
const tex = await loadSpriteTexture('Goblin Tower') // loads /sprites/goblin-tower.svg

// 3-frame walk animation
const frames = await loadAnimFrames('Goblin', 3) // loads goblin-1/2/3.svg
const anim = new PIXI.AnimatedSprite(frames)
anim.animationSpeed = 6 / 60  // 6 fps
anim.play()
```

Both helpers use an in-memory texture cache so each SVG URL is only fetched once.

### Event bridge (PixiJS → React)

Use a `useRef` to hold the current callback and read it from PixiJS event handlers:

```typescript
const callbackRef = useRef(onCellClick)
callbackRef.current = onCellClick

usePixiApp(canvasRef, W, H, (app) => {
  hitArea.on('pointerdown', (e) => {
    const { x, y } = e.getLocalPosition(hitArea)
    callbackRef.current(Math.floor(x / CELL_PX), Math.floor(y / CELL_PX))
  })
})
```

### Performance rules

- Use `PIXI.Ticker` (or the app's built-in ticker) for per-frame animation — never `setInterval`.
- Call `graphics.clear()` then redraw every frame for dynamic Graphics; re-use `PIXI.Sprite` positions for static assets.
- Set `antialias: false` for pixel-art sprites; `true` for smooth vector graphics.
- The texture cache in `pixiHelpers.ts` prevents duplicate loads across components.

### Migrated components

| Component | File | Status |
|---|---|---|
| TowerDefence grid | `towerdefence/GameGrid.tsx` | ✅ PixiJS |
| NodeMap terrain + connectors | `campaign/NodeMap.tsx` | Pending |
| Battlefield lane canvas | `battle/BattlefieldCanvas.tsx` | ✅ PixiJS |
| CityBuilder road wear | `citybuilder/CityTerrainCanvas.tsx` | ✅ PixiJS |
| CityBuilder walkers | `citybuilder/CityWalkerCanvas.tsx` | ✅ PixiJS |

---

## Editing Act JSON Files

Act files (`web/src/data/acts/actN.json`) are large. Use the cheapest tool for the scope of the change:

| Change scope | Correct tool | Why |
|---|---|---|
| A few fields on a few nodes | `Edit` with targeted `old_string` | Minimal tokens — only the diff |
| Complete nodes section replacement | `Write` with the full file | 1 call; script overhead costs more |
| Single node deck / HP tweak | `Edit` matching the specific array | Surgical — no metadata risk |

**Never write a temp script to do JSON manipulation.** Writing the script + fixing it + running it + cleaning up = 4–5 tool calls and the script content itself is just as long as a `Write` call. Write the file directly instead.

**Never spawn Explore/Plan agents for act work** — read the relevant files directly with `Read` and `Glob`. Agents are banned unless the user explicitly requests them (see "Development and Token Use" above).

---

## Hub World — Data Schemas

All hub world JSON schemas (blocked paths, pickup items, NPCs, tile IDs, sprite names) are in **[`docs/hubworld.md`](docs/hubworld.md)**. Read it before:
- Adding or editing blocked paths (`web/src/data/hub/questDefs.json` → `blockedPaths`)
- Adding pickup items or changing `requireTouch` behaviour
- Adding hub NPCs or decor tiles

---

## Acts — Design Rules

All rules for acts, the campaign map, node types, relics, heroes, lives system, music, boss traits, and card authoring are in **[`docs/acts.md`](docs/acts.md)**. The second campaign's story bible (premise, per-act bosses/relics/heroes for `c2act*`) is **[`docs/campaign2.md`](docs/campaign2.md)** — read it before authoring any campaign 2 act. Read `docs/acts.md` before:
- Creating or modifying act JSON files (`web/src/data/acts/*.json`)
- Adding new node types, relics, hero cards, or boss mechanics
- Authoring campaign story text or replay variants
- Adding or modifying boss traits (see §13 — Boss Traits)

The doc also contains the **Act Authoring Checklist** (§12) — run through it for every new act.

> **Boss Traits:** Every boss has one unique trait (burrow, fly, split, jump AOE, column AOE, etc.) defined in the `trait` object inside `web/src/data/bossAIs.json`. Full mechanical specs, the trait type reference, and implementation notes are in **`docs/acts.md §13`**.

---

## Creating a New Act — Step-by-Step

Use this when implementing an act from the Acts 7–25 plan in `todo.md`. Work through the steps in order; build and push after each step.

### 1. Cards & unit templates — `web/src/data/cards.json`

Add **25 themed cards** covering all three card types (unit, structure, upgrade), spread across rarities (roughly 6 common / 6 uncommon / 6 uncommon structures / 4 rare / 2 epic / 1 legendary).

For each **unit** card:
- Add a card entry in the `cards` array with `name`, `rarity`, `cost`, `cardType: "unit"`, `unitRef`, `description`, `deckCount: 0`, `tags`, and `lore`.
- Add a matching template in the `templates` object keyed by `unitRef` slug. The template **must include `name`** (title-case of the slug) alongside the stat fields.

For **structure** and **upgrade** cards, follow the same pattern — structures that spawn units need a `structureEffect` block with `type: "spawn"` and `unitTemplateRef`.

Check that the card names used in act node enemy decks (step 2) are all present here.

### 2. Act map — `web/src/data/acts/actN.json`

Create the file following the **standard 7-row, 13-node, 2-path branching layout** used by all existing acts. See `docs/acts.md §1.1` for the full spec and column assignments. The structure is:

| Row | Nodes | Path / Types | `rowCols` |
|-----|-------|-------------|-----------|
| 0   | 1     | battle (start) | 1 |
| 1   | 2     | event (col 0) + rest (col 3) — player picks one | 4 |
| 2   | 4     | [A: battle, event] + [B: event, merchant] (cols 0–3) | 4 |
| 3   | 2     | A-elite (col 0) + B-rest (col 3) | 4 |
| 4   | 2     | A-battle (col 0) + B-battle (col 3) | 4 |
| 5   | 1     | rest or event (pre-boss) | 1 |
| 6   | 1     | boss | 1 |

Choosing the row-1 left node locks out all right-side nodes in rows 2–4 (and vice versa). Both paths converge at row 5 before the boss. Wire `parentIds`/`childIds` exactly as documented in `docs/acts.md §1.2`.

Required top-level fields: `id`, `title` (`"ACT VII"`), `subtitle`, `rewardRelic`, `rewardRelicDesc`, `environment`, `rewardTags`, `replayModifiers` (copy the standard 5-modifier block from a previous act), `startNodeIds`, `intro` (3 panels), `outro` (3 panels), `nodes`.

Each node needs: `id`, `type`, `label`, `description`, `row`, `col`, `rowCols`, `parentIds`, `childIds`. Battle/elite/boss nodes also need `handicap`, `opponentIntervalMs`, `opponentBaseHp`, `environment`, `enemyDeck`. The boss node additionally needs `bossAI` (matching the ID in `bossAIs.json`) and `bossDialogue` (3 lines). Event nodes need `eventConfig` with `title`, `description`, and `pools`.

**Escalate difficulty** across nodes: start around `handicap: 12` / `opponentBaseHp: 205` and end at approximately `handicap: 26–28` / `opponentBaseHp: 255–270` for the boss. See act6.json and act7.json for reference values.

### 3. Boss AI — `web/src/data/bossAIs.json`

Append a new entry to the array. Every entry needs:
```json
{
  "id": "bossslug",
  "intervalMs": 5000,
  "idleMessage": "Flavour text when no card is played…",
  "maxPlaysPerTurn": 3,
  "openingLog": ["Line one shown at battle start.", "Line two."],
  "phases": [...]
}
```

**Phase conditions** (all optional, combined with AND):
- `gameTimeGte` / `gameTimeLt` — milliseconds elapsed
- `opponentFieldCountGte` — opponent units on field (excluding walls)
- `wavePhaseEven` — `true`/`false` based on `Math.floor(gameTime/20000) % 2`

**Priority filters** (checked in order; first non-empty bucket wins):
- `cardType`: `"unit"` | `"structure"` | `"upgrade"` (required)
- `isWall`: `true`/`false`
- `flying`: `true`/`false`
- `nameIn`: array of exact card names
- `costGte` / `costLt`: number
- `structureEffect`: `"spawn"` | `"mana"` | `"none"` (none = no effect = ranged tower)
- `sortBy`: `"cost_asc"` | `"cost_desc"`

**Phase-level overrides** (optional):
- `manaOverride`: number — replaces mana cap for this phase (e.g. `99` for unlimited)
- `maxPlaysOverride`: number — replaces `maxPlaysPerTurn`
- `announceOnce`: string — logged once when `gameTime` first enters a `gameTimeGte`-gated phase (window: ±1 s)

The last phase should always have `"condition": null` as a catch-all.

### 4. Relic — `web/src/game/relics.ts`

Append a new entry to `RELIC_CATALOG`:
```typescript
{
  name: 'Relic Name',   // must match rewardRelic in actN.json exactly
  icon: '🔮',
  desc: 'One-sentence description shown in UI.',
  applyToGame(state) {
    // Mutate state at battle start.
    // state.playerBase.hp / .maxHp — base HP
    // state.field (Unit[]) — owner === 'player' units
    // state.relicManaBonus — add to this for mana bonuses
    // state.soulstoneReviveAvailable = true — for revive relics
  },
},
```

`applyToGame` is called once at the start of every battle. Keep it side-effect-free outside of `state`.

### 5. Wire into questline — `web/src/game/questline.ts`

```typescript
// At the top with other imports:
import act7Data from '../data/acts/act7.json'

// Near the bottom with other ACT exports:
export const ACT_7: Act = act7Data as Act

// In the ACTS record:
export const ACTS: Record<string, Act> = {
  // ...existing acts...
  act7: ACT_7,
}
```

### 6. Build & verify

```bash
cd web && npm run build
```

Fix any TypeScript errors (most common: missing `name` in a template, mismatched `unitRef`, wrong card name in an enemy deck). The build must pass clean before committing.

### 7. Update todo.md & commit

Mark the act done in the **Progress** list with a session note. Update the sprite backlog section — add a stub for the next act's sprites (the new act's sprites go into the existing Act N block that was added when cards were authored).

Commit message format:
```
feat(actN): implement <Title>

- actN.json: <node count>-node map (<start> → <boss>); brief node summary
- bossAIs.json: <bossslug> config — describe phase logic
- relics.ts: <Relic Name> — one-line effect description
- questline.ts: import actNData, export ACT_N, add to ACTS map
- todo.md: mark Act N done; stub Act N+1 sprite section
```

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
