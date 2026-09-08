# Mini-game Brief — a reusable starting prompt

A template for adding a new mini-game to the hub world. Paste the block below
into a fresh session, cold — it assumes no prior context.

It was written from what actually worked while building **Wellspring**
(`docs/minigame-wellspring.md`), which is the reference for the standard the
brief is asking for: read that doc and its implementation alongside this.

Two caveats worth knowing before reusing it:

- **The affordance is the hard part, and it gets harder each time.** Fishing
  took the water; Wellspring took the wells. What's left unclaimed and
  widely-present is thinner — barrels (12 towns), crates (8), rocks (8),
  gravestones (4). Constraint 4 may honestly come back with *"nothing good is
  left"*, and the right answer then is a new decor tile placed across every
  town, or a building interior rather than exterior scenery. Accept that answer
  if it comes; don't force a bad fit onto whatever happens to be lying around.
- **Constraint 3 is stated more absolutely than it deserves.** Hub-only was
  right for Wellspring because the fiction was strong and the arcade framing
  fought it. A game genuinely about score-chasing might belong in the arcade
  instead. If a session pushes back on that constraint with a good reason,
  hear it.

---

```markdown
Design and build a new mini-game for this repo. Read AGENTS.md in full first,
then `docs/minigame-wellspring.md` — that's the reference for the standard I
want, both the design doc and the implementation.

## Constraints

**1. Fill a real gap.** Before choosing a mechanic, inventory every existing
mini-game in `components/minigames/` and classify what each actually asks of
the player (reflex / luck / memory / management / strategy / logic). Pick
something the roster genuinely lacks. Tell me the classification table and
what's missing before you commit to an idea.

**2. It must never run out of content.** Prefer mechanics that generate
procedurally and are correct by construction. If generating a good instance is
a research problem (Sokoban) or requires uniqueness-checking (nonogram), say so
and pick something else. Hand-authored levels are a finite content pile — don't.

**3. It lives in the hub world, not the arcade menu.** Do NOT add it to
`MiniGamesMenu`, `MiniGameId`, `economy.json`'s `miniGameCosts`, or
`miniGameDailyChallenge.ts`. It should be reached by interacting with something
in a town, the way fishing is reached by tapping water.

**4. Find the affordance with data, not a guess.** Survey what's actually in
`web/src/data/hub/*/config.json` — count decor tiles and terrain types across
all 13 towns, and check nothing already claims them. Aim for something present
in most towns and currently unused, so no new art is needed. Show me the counts.

**5. Reuse the existing engine.** A `hitRect` interactable with a `screen`
reaction needs no new engine code. Per-day cooldowns already exist
(`game/hub/digs.ts`, `forages.ts`, `wellsprings.ts`). Tool gating already
exists (the fishing-rod and winding-crank checks in `HubWorld.tsx`'s
`handleNodeInteract`). Locale variants already ride in the screen id
(`hub-fishing-cave`/`-lake`/`-ocean`, `hub-wellspring-deep`/`-vault`).

**6. An NPC must point at it.** Scenery is easy to walk past a hundred times.
Give it proximity dialogue that changes with state — one line at distance that
something's wrong, a closer one naming what would fix it, including where to
buy any required tool, and nothing nagging once it's done for the day. Match
NPCs by id suffix so adding a town needs no code change. See
`game/hub/wellsprings.ts`'s `wellKeeperDialogue` and how `HubWorld.tsx`
populates `npcProximityDialogueRef` from it.

**7. Rewards feed existing systems.** Crystals, town reputation, a cooking
ingredient, a collectible — not a dead-end currency. Say which existing system
each reward lands in.

**8. Difficulty: rank the knobs, don't just list them.** Tell me which dial
actually changes how hard the thinking is versus which just makes it longer.
Reject any lever that changes the genre (a countdown on a thinking game) or
punishes exploration (a hard fail cap), and say why.

## Process

Write `docs/minigame-<name>.md` first — gap analysis, rejected alternatives
with reasons, core rules, generation/correctness with named risks, difficulty,
hub integration, UI (portrait-first, per-state table, motion, a11y), and a
commit-by-commit plan. **Push that and stop for my approval before writing any
game code.**

Then build it in small commits, each independently green (`npm run build` +
`npm run test`), pushed as they land. Open a PR when the first code lands.

## Verification — tests are not enough

- **Measure, don't estimate.** If the design quotes numbers (difficulty
  ranges, expected scores), generate a few hundred instances and report the
  real distribution. Correct the doc where it was wrong.
- **Look at it.** Screenshot the Storybook stories via Playwright and
  DOM-measure anything geometry-sensitive (see `docs/ui-design.md`). Clean up
  `.env.local` and any probe scripts before committing.
- **Play it end to end** and report what that changed. Something always does.
- **Add an integrity test** guarding the entrance across all towns, so a
  missing or misplaced entry point fails the build rather than being silently
  invisible in one town. See `data/hub/wellspringPlacement.test.ts`.

## Known landmines in this repo

- `@keyframes` animating an SVG geometry property (`r`, `cx`) silently does
  nothing in WebKit, which the test suite runs. Use `transform`/`opacity` with
  an explicit `transform-box`.
- The loader resolves a decor `tileId` from its constant name to a **numeric**
  chip id — comparing against the string in a test matches nothing.
- `locationRegistry` is keyed by locationKey (`dreadspire-citadel`), not the
  config directory name (`dreadspirecitadel`).
- React invokes a state updater twice in StrictMode. Never fire sound or other
  side effects inside one.
- `pressFeedback.test.ts` fails the build on any hover-only control. Cells in a
  fixed grid use `filter: brightness(1.35)`, never `translateY`.
- Rewriting a town `config.json` or `hubItems.json` through `json.dumps`
  reformats the whole file. Insert textually to keep the diff readable.
- Run `npm install` first, then `git restore web/package-lock.json`.

Tell me your gap analysis and proposed mechanic before you start designing.
```
